#include "mqtt_manager.h"

#include <cbor.h>

#include "funcreg.h"
#include "posix_sockets.h"
#include "rtsyched.h"
#include "task_allocator.h"

typedef struct __DeduplicationTableEntry {
  struct timeout t;
  char cont[42];
  UT_hash_handle hh;
} DeduplicationTableEntry;

static struct timeouts timerDedupTable;
static DeduplicationTableEntry *deduplicationTable;
static ContextMutex mtxDedupTable;

static TaskType kTaskTypeLookUp[5] = {JAMC_REXEC_BATCH, JAMC_REXEC_RT,
                                      JAMC_REXEC_SYNC, JAMC_REXEC_INTERACTIVE,
                                      JAMC_REXEC_ERROR_TYPE};
static char selfUUID[33];
static uint32_t idGenerator = 0U;
static __thread MQTTDataTransmitter
    lruCacheArrayThreadLocal[JAMC_MQTT_TXMTR_LRU_CACHE_SIZE];
static int GetMQTTDataTransmitter(MQTTDataTransmitter **txr, const char *ip,
                                  const char *uuid, int port);
static float cbor_get_float(cbor_item_t *item);
static inline int cbor_get_integer(cbor_item_t *item) {
  // Check if the other side is sending a float.. if so
  // print a warning and convert to integer
  if (cbor_typeof(item) == CBOR_TYPE_FLOAT_CTRL) {
    printf("WARNING! Float value in the stream..\n");
    float f = cbor_get_float(item);
    return (int)lround(f);
  } else {
    switch (cbor_int_get_width(item)) {
      case CBOR_INT_8:
        if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
          return -1 * cbor_get_uint8(item);
        else
          return cbor_get_uint8(item);
        break;

      case CBOR_INT_16:
        if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
          return -1 * cbor_get_uint16(item);
        else
          return cbor_get_uint16(item);
        break;

      case CBOR_INT_32:
        if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
          return -1 * cbor_get_uint32(item);
        else
          return cbor_get_uint32(item);
        break;

      case CBOR_INT_64:
        if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
          return -1 * cbor_get_uint64(item);
        else
          return cbor_get_uint64(item);
        break;
    }
    // error condition
    return -1;
  }
}

static float cbor_get_float(cbor_item_t *item) {
  int t = cbor_typeof(item);
  if (t == CBOR_TYPE_NEGINT || t == CBOR_TYPE_UINT) {
    printf("WARNING! Int value in the stream.. \n");
    int i = cbor_get_integer(item);
    return (float)i;
  } else {
    return cbor_float_get_float8(item);
  }
}

static inline int GetTaskAttribute(cbor_item_t *item,
                                   RemoteExecutionAttribute *attribute) {
  attribute->args = NULL;
  attribute->result = NULL;
  attribute->type = JAMC_REXEC_ERROR_TYPE;
  size_t numDeArticles = cbor_map_size(item);
  if (numDeArticles) {
    struct cbor_pair *mitems = cbor_map_handle(item);
    for (size_t i = 0; i < numDeArticles; i++) {
      if (!strncmp(cbor_string_handle(mitems[i].key), "args", 4)) {
        attribute->args = mitems[i].value;
        mitems[i].value = cbor_new_int8();
        continue;
      }
      if (!strncmp(cbor_string_handle(mitems[i].key), "func", 4)) {
        attribute->taskFunction = 
            GetFunctionByName(cbor_string_handle(mitems[i].value), cbor_string_length(mitems[i].value));
        attribute->taskStackSize = 
            GetStackSizeByName(cbor_string_handle(mitems[i].value), cbor_string_length(mitems[i].value));
        attribute->dur = 
            GetDurationByName(cbor_string_handle(mitems[i].value), cbor_string_length(mitems[i].value));
        continue;
      }
      if (!strncmp(cbor_string_handle(mitems[i].key), "id", 2)) {
        attribute->id = cbor_get_uint32(mitems[i].value);
        continue;
      }
      if (!strncmp(cbor_string_handle(mitems[i].key), "indx", 4)) {
        attribute->idx = cbor_get_uint32(mitems[i].value);
        continue;
      }
      if (!strncmp(cbor_string_handle(mitems[i].key), "type", 4)) {
        attribute->type = kTaskTypeLookUp[cbor_get_uint32(mitems[i].value)];
        continue;
      }
      if (!strncmp(cbor_string_handle(mitems[i].key), "uuid", 4)) {
        memset(attribute->uuid, 0, 33);
        strncpy(attribute->uuid, cbor_string_handle(mitems[i].value), 32);
        continue;
      }
    }
    switch (attribute->type) {
      case JAMC_REXEC_BATCH:
        attribute->taskContent.batchAttribute.runBatchTaskInRTThread = 0;
        break;
      case JAMC_REXEC_RT:
        attribute->taskContent.rtAttribute.slotId = 32;
        break;
      case JAMC_REXEC_SYNC:
        break;
      case JAMC_REXEC_INTERACTIVE:
        attribute->taskContent.interactiveAttribute.deadline.tv_sec = 0;
        attribute->taskContent.interactiveAttribute.deadline.tv_nsec = 0;
        break;
      default:
        break;
    }
    for (size_t i = 0; i < numDeArticles; i++) {
      switch (attribute->type) {
        case JAMC_REXEC_BATCH:
          if (!strncmp(cbor_string_handle(mitems[i].key), "on_rt_thread", 12)) {
            attribute->taskContent.batchAttribute.runBatchTaskInRTThread =
                cbor_get_uint32(mitems[i].value);
          }
          break;
        case JAMC_REXEC_RT:
          if (!strncmp(cbor_string_handle(mitems[i].key), "slot_id", 7)) {
            attribute->taskContent.rtAttribute.slotId =
                cbor_get_uint16(mitems[i].value);
          }
          break;
        case JAMC_REXEC_SYNC:
          break;
        case JAMC_REXEC_INTERACTIVE:
          if (!strncmp(cbor_string_handle(mitems[i].key), "deadline", 8)) {
            struct tm td;
            strptime(cbor_string_handle(mitems[i].value), "%Y-%m-%d %H:%M:%S",
                     &td);
            attribute->taskContent.interactiveAttribute.deadline.tv_sec =
                mktime(&td);
          }
          if (!strncmp(cbor_string_handle(mitems[i].key), "deadline_nsec_extra",
                       19)) {
            attribute->taskContent.interactiveAttribute.deadline.tv_nsec =
                cbor_get_uint64(mitems[i].value);
          }
          break;
        default:
          break;
      }
    }
  }
  return 0;
}

static inline int GetConnIPAddrAndPortFromPayload(cbor_item_t *item,
                                                  char *ipAddr, int *port,
                                                  char *uuid) {
  if (cbor_map_size(item) != 2) return -1;
  struct cbor_pair *mitems = cbor_map_handle(item);
  for (int i = 0; i < 2; i++) {
    if (!strncmp(cbor_string_handle(mitems[i].key), "ip", 2)) {
      strcpy(ipAddr, cbor_string_handle(mitems[i].value));
    }
    if (!strncmp(cbor_string_handle(mitems[i].key), "uuid", 4)) {
      memset(uuid, 0, 33);
      strncpy(uuid, cbor_string_handle(mitems[i].value), 32);
    }
    if (!strncmp(cbor_string_handle(mitems[i].key), "port", 4)) {
      *port = cbor_get_int(mitems[i].value);
    }
  }
  return 0;
}

static inline int ParseC2JDataRecv(cbor_item_t *item,
                                   MQTTWaitObject *waitObject) {
  size_t sz = cbor_map_size(item);
  struct cbor_pair *mitems = cbor_map_handle(item);
  for (size_t i = 0; i < sz; i++) {
    if (!strncmp(cbor_string_handle(mitems[i].key), "res", 3)) {
      waitObject->data = mitems[i].value;
      mitems[i].value = cbor_new_definite_map(0);
    }
    if (!strncmp("indx", cbor_string_handle(mitems[i].key), cbor_string_length(mitems[i].key))) {
      MQTTC2JAttr *attr = (MQTTC2JAttr *)(waitObject);
      attr->idx = cbor_get_uint32(mitems[i].value);
    }
  }
  return 0;
}

static inline int ParseC2JAckRecv(cbor_item_t *item, MQTTWaitObject *waitObject) {
  size_t sz = cbor_map_size(item);
  struct cbor_pair *mitems = cbor_map_handle(item);
  for (size_t i = 0; i < sz; i++) {
    if (!strncmp("ack", cbor_string_handle(mitems[i].key), cbor_string_length(mitems[i].key))) {
      MQTTC2JAttr *attr = (MQTTC2JAttr *)(waitObject - 1);
      attr->dur.tv_sec = cbor_get_uint64(cbor_array_get(mitems[i].value, 0));
      attr->dur.tv_nsec = cbor_get_uint64(cbor_array_get(mitems[i].value, 1));
      return 0;
    }
    if (!strncmp("indx", cbor_string_handle(mitems[i].key), cbor_string_length(mitems[i].key))) {
      MQTTC2JAttr *attr = (MQTTC2JAttr *)(waitObject - 1);
      attr->idx = cbor_get_uint32(mitems[i].value);
      return 0;
    }
  }
  return 1;
}


static inline int NotifyAckObject(MQTTDataTransmitter *transmitter, MQTTWaitObject *waitObject, int isReady) {
  jamCall(ContextMutexLock(&(waitObject->mtxMQTTWait)), 1);
  waitObject->ready = isReady;
  jamCall(ContextConditionVariableNotifyAll(&(waitObject->cvMQTTWait)), 1);
  jamCall(ContextMutexUnlock(&(waitObject->mtxMQTTWait)), 1);
  return 0;
}

static inline int ReturnCancelledTransmitterToLRUCache(void *txr) {
  ((MQTTDataTransmitter *)txr)->used = 0;
  return 0;
}

void ReconnectCallbackPooler(struct mqtt_client *client, void** state) {
  MQTTDataTransmitter *tx = *state;
  TaskCommonHeader *ctask;
  char idxCli[5];
  GetActiveTask(&ctask);
  memset(idxCli, 0, 5);
  sprintf(idxCli, "/%d", GetExecutorIndex(ctask->executor, ctask->executor->schedulerManager));
  printf("reconnect called on pooler\n");
  close(client->socketfd);
  tx->sockfd = open_nb_socket(tx->ipAddr, tx->port);
  //memset(&(tx->sendbuf[0]), 0, JAMC_MQTT_SEND_BUF_SIZE);
  //memset(&(tx->recvbuf[0]), 0, JAMC_MQTT_RECV_BUF_SIZE);
  tx->sendBufLen *= 2;
  tx->recvBufLen *= 2;
  free(tx->sendbuf);
  free(tx->recvbuf);
  tx->sendbuf = malloc(tx->sendBufLen);
  tx->recvbuf = malloc(tx->recvBufLen);
  mqtt_reinit(client, tx->sockfd, 
              tx->sendbuf, tx->sendBufLen, 
              tx->recvbuf, tx->recvBufLen);
  mqtt_connect(client, NULL, NULL, NULL, 0, NULL, NULL,
               MQTT_CONNECT_CLEAN_SESSION, 400);
  sprintf(tx->callTopic, "/%s%s", tx->uuid, JAMC_MQTT_TASK_CHANNEL);
  sprintf(tx->topic[MQTT_WAIT_C2J_CALL_ACK], "/%s/%s/%s", selfUUID, tx->uuid, JAMC_MQTT_CALL_ACK);
  strcat(tx->topic[MQTT_WAIT_C2J_CALL_ACK], idxCli);
  sprintf(tx->topic[MQTT_WAIT_C2J_DATA], "/%s/%s/%s", selfUUID, tx->uuid, JAMC_MQTT_RES_DATA);
  strcat(tx->topic[MQTT_WAIT_C2J_DATA], idxCli);
  sprintf(tx->topic[MQTT_WAIT_J2C_DATA_ACK], "/%s/%s/%s", tx->uuid, selfUUID, JAMC_MQTT_RES_ACK);
  strcat(tx->topic[MQTT_WAIT_J2C_DATA_ACK], idxCli);
  sprintf(tx->topic[MQTT_PUB_J2C_CALL_ACK], "/%s/%s/%s", tx->uuid, selfUUID, JAMC_MQTT_CALL_ACK);
  sprintf(tx->topic[MQTT_PUB_J2C_DATA], "/%s/%s/%s", tx->uuid, selfUUID, JAMC_MQTT_RES_DATA);
  sprintf(tx->topic[MQTT_PUB_C2J_DATA_ACK], "/%s/%s/%s", selfUUID, tx->uuid, JAMC_MQTT_RES_ACK);
  mqtt_subscribe(&(tx->client), tx->topic[MQTT_WAIT_C2J_CALL_ACK], JAMC_MQTT_QOS);
  mqtt_subscribe(&(tx->client), tx->topic[MQTT_WAIT_C2J_DATA], JAMC_MQTT_QOS);
  mqtt_subscribe(&(tx->client), tx->topic[MQTT_WAIT_J2C_DATA_ACK], JAMC_MQTT_QOS);
}

static inline int CancelTransmitter(void *_pTransmitter) {
  printf("cancel called\n");
  MQTTDataTransmitter *transmitter = _pTransmitter;
  TaskCommonHeader *poolerTask = (TaskCommonHeader *)(transmitter->poolerTask);
  BaseTaskExecutor *currExecutor = poolerTask->executor;
  TaskCommonHeader *currentTask;
  void *prevArg;
  jamCall(GetActiveTask(&currentTask), 1);
  jamCall(GetTaskData(&prevArg, currentTask), 1);
  jamCall(SetTaskData(currentTask, transmitter), 1);
  jamCall(__ContextSpinMutexInternalLock(&(currExecutor->mtxTimer)), 1);
  if (!timeout_pending(&(poolerTask->timeOut))) {
    jamCall(PlatformMutexLock(&(currExecutor->mtxReadyQueue)), 1);
    /*if (!((poolerTask->elemHook.prev == LIST_POISON_PREV || poolerTask->elemHook.prev == NULL || poolerTask->elemHook.prev == poolerTask) && 
        (poolerTask->elemHook.next == LIST_POISON_NEXT || poolerTask->elemHook.next == NULL || poolerTask->elemHook.next == poolerTask))) {
      
    }*/
    list_remove(&(currExecutor->readyQueue), &(poolerTask->elemHook));
    jamCall(PlatformMutexUnlock(&(currExecutor->mtxReadyQueue)), 1);
  } else {
    timeout_del(&(poolerTask->timeOut));
  }
  jamCall(__ContextSpinMutexInternalUnlock(&(currExecutor->mtxTimer)), 1);
  for (int i = 0; i < 3; i++) {
    MQTTWaitObject *currentWaitObject = NULL, *tmpWaitObject = NULL;
    mqtt_unsubscribe(&(transmitter->client), transmitter->topic[i]);
    HASH_ITER(hh, transmitter->pendingRetries[i], currentWaitObject, tmpWaitObject) {
      NotifyAckObject(transmitter, currentWaitObject, 0);
      HASH_DEL(transmitter->pendingRetries[i], currentWaitObject);
    }
  }
  mqtt_disconnect(&(transmitter->client));
  mqtt_sync(&(transmitter->client));
  close(transmitter->sockfd);
  free(transmitter->sendbuf);
  free(transmitter->recvbuf);
  jamCall(ReturnCancelledTransmitterToLRUCache(transmitter), 1);
  jamCall(SetTaskData(currentTask, prevArg), 1);
  return 0;
}

static inline int BuildJ2CResult(RemoteExecutionAttribute *attr) {
  TaskCommonHeader *ctask;
  GetActiveTask(&ctask);
  attr->resMap = cbor_new_definite_map(3);
  attr->resBufferSize = 1024;
  if (!(attr->result)) {
    attr->result = cbor_new_definite_map(0);
  }
  cbor_map_add(attr->resMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("indx")),
                           .value = cbor_move(cbor_build_uint32(GetExecutorIndex(ctask->executor, ctask->executor->schedulerManager)))});
  cbor_map_add(attr->resMap,
               (struct cbor_pair){.key = cbor_move(cbor_build_string("id")),
                                  .value = cbor_move(cbor_build_uint32(attr->id))});
  cbor_map_add(attr->resMap,
               (struct cbor_pair){.key = cbor_move(cbor_build_string("res")),
                                  .value = cbor_move(attr->result)});
  attr->resLength = cbor_serialize(attr->resMap, attr->resBuffer,
                                         attr->resBufferSize);
  cbor_decref(&(attr->resMap));
  return 0;
}

static inline int BuildC2JArgs(MQTTC2JAttr *attr) {
  TaskCommonHeader *ctask;
  GetActiveTask(&ctask);
  cbor_item_t *argMap = cbor_new_definite_map(7);
  attr->argBufLen = 1024;
  if (!(attr->args)) {
    attr->args = cbor_new_definite_map(0);
  }
  cbor_map_add(argMap,
               (struct cbor_pair){.key = cbor_move(cbor_build_string("args")),
                                  .value = cbor_move(attr->args)});
  cbor_map_add(argMap,
               (struct cbor_pair){
                   .key = cbor_move(cbor_build_string("func")),
                   .value = cbor_move(cbor_build_string(attr->funcName))});
  cbor_map_add(argMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("id")),
                           .value = cbor_move(cbor_build_uint32(attr->id))});
  cbor_map_add(argMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("indx")),
                           .value = cbor_move(cbor_build_uint32(GetExecutorIndex(ctask->executor, ctask->executor->schedulerManager)))});
  cbor_map_add(argMap,
               (struct cbor_pair){.key = cbor_move(cbor_build_string("type")),
                                  .value = cbor_move(cbor_build_uint32(0))});
  cbor_map_add(argMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("on_rt_thread")),
                           .value = cbor_move(cbor_build_uint32(0))});
  cbor_map_add(argMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("uuid")),
                           .value = cbor_move(cbor_build_string(selfUUID))});
  attr->argActLen =
      cbor_serialize(argMap, attr->argBuffer, attr->argBufLen);
  cbor_decref(&argMap);
  return 0;
}

static inline int PublishError(RemoteExecutionAttribute *attr) {
  TaskCommonHeader *currentTask;
  MQTTDataTransmitter *transmitter = NULL;
  char combinedTopic[JAMC_MQTT_RPC_DATA_CHANNEL_SIZE], idxCli[5];
  void *prevArg;
  jamCall(GetActiveTask(&currentTask), 1);
  jamCall(GetTaskData(&prevArg, currentTask), 1);
  memset(idxCli, 0, 5);
  sprintf(idxCli, "/%u", attr->idx);
BeginPublishError:
  jamCall(GetMQTTDataTransmitter(&transmitter, attr->ipAddr, attr->uuid, attr->port), 1);
  jamCall(SetTaskData(currentTask, transmitter), 1);
  cbor_item_t *errMap = cbor_new_definite_map(2);
  size_t errBufferSize = 1024;
  unsigned char errBuffer[errBufferSize];
  cbor_map_add(errMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("id")),
                           .value = cbor_move(cbor_build_uint32(attr->id))});
  cbor_map_add(errMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("error")),
                           .value = cbor_move(cbor_build_string("error"))});
  size_t argLength = cbor_serialize(errMap, errBuffer, errBufferSize);
  memset(attr->sendBackTopicName, 0, JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
  sprintf(attr->sendBackTopicName, "/%s%s/%08x%s", attr->uuid,
          JAMC_MQTT_J2C_CHANNEL_PREFIX, attr->id,
          JAMC_MQTT_RES_DATA_CHANNEL_PREFIX);
  memset(combinedTopic, 0, JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
  strcpy(combinedTopic, transmitter->topic[MQTT_PUB_J2C_DATA]);
  strcat(combinedTopic, idxCli);
  mqtt_publish(&(transmitter->client), combinedTopic, errBuffer,
               argLength, JAMC_MQTT_QOS);
  mqtt_sync(&(transmitter->client));
  if (transmitter->client.error != MQTT_OK) {
    jamCall(CancelTransmitter(transmitter), 1);
    goto BeginPublishError;
  }
  free(errBuffer);
  cbor_decref(&errMap);
  jamCall(SetTaskData(currentTask, prevArg), 1);
  return 0;
}

static inline int PublishJ2CCallAck(RemoteExecutionAttribute *attr) {
  TaskCommonHeader *currentTask;
  MQTTDataTransmitter *transmitter = NULL;
  char combinedTopic[JAMC_MQTT_RPC_DATA_CHANNEL_SIZE], idxCli[5];
  void *prevArg;
  jamCall(GetActiveTask(&currentTask), 1);
  jamCall(GetTaskData(&prevArg, currentTask), 1);
  memset(idxCli, 0, 5);
  sprintf(idxCli, "/%u", attr->idx);
BeginPublishJ2CCallAck:
  jamCall(GetMQTTDataTransmitter(&transmitter, attr->ipAddr, attr->uuid, attr->port), 1);
  jamCall(SetTaskData(currentTask, transmitter), 1);
  cbor_item_t *ackMap = cbor_new_definite_map(3);
  cbor_item_t *timeArray = cbor_new_definite_array(2);
  cbor_array_set(timeArray, 0, cbor_move(cbor_build_uint64(attr->dur.tv_sec)));
  cbor_array_set(timeArray, 1, cbor_move(cbor_build_uint64(attr->dur.tv_nsec)));
  size_t ackBufferSize = 1024;
  unsigned char ackBuffer[ackBufferSize];
  cbor_map_add(ackMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("id")),
                           .value = cbor_move(cbor_build_uint32(attr->id))});
  cbor_map_add(
      ackMap, (struct cbor_pair){.key = cbor_move(cbor_build_string("ack")),
                                 .value = cbor_move(timeArray)});
  cbor_map_add(ackMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("indx")),
                           .value = cbor_move(cbor_build_uint32(GetExecutorIndex(currentTask->executor, currentTask->executor->schedulerManager)))});
  size_t ackLength = cbor_serialize_alloc(ackMap, ackBuffer, ackBufferSize);
  memset(combinedTopic, 0, JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
  strcpy(combinedTopic, transmitter->topic[MQTT_PUB_J2C_CALL_ACK]);
  strcat(combinedTopic, idxCli);
  mqtt_publish(&(transmitter->client), combinedTopic, ackBuffer,
               ackLength, JAMC_MQTT_QOS);
  mqtt_sync(&(transmitter->client));
  if (transmitter->client.error != MQTT_OK) {
    jamCall(CancelTransmitter(transmitter), 1);
    goto BeginPublishJ2CCallAck;
  }
  free(ackBuffer);
  cbor_decref(&ackMap);
  jamCall(SetTaskData(currentTask, prevArg), 1);
  return 0;
}

static inline int PublishC2JDataAck(MQTTC2JAttr *attr) {
  TaskCommonHeader *currentTask;
  MQTTDataTransmitter *transmitter = NULL;
  char combinedTopic[JAMC_MQTT_RPC_DATA_CHANNEL_SIZE], idxCli[5];
  void *prevArg;
  jamCall(GetActiveTask(&currentTask), 1);
  jamCall(GetTaskData(&prevArg, currentTask), 1);
  memset(idxCli, 0, 5);
  sprintf(idxCli, "/%u", attr->idx);
BeginPublishC2JDataAck:
  jamCall(GetMQTTDataTransmitter(&transmitter, attr->ipAddr, attr->uuid, attr->port), 1);
  jamCall(SetTaskData(currentTask, transmitter), 1);
  cbor_item_t *ackMap = cbor_new_definite_map(2);
  size_t ackBufferSize = 1024;
  unsigned char ackBuffer[ackBufferSize];
  cbor_map_add(ackMap, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("id")),
                           .value = cbor_move(cbor_build_uint32(attr->id))});
  cbor_map_add(
      ackMap, (struct cbor_pair){.key = cbor_move(cbor_build_string("ack")),
                                 .value = cbor_move(cbor_build_string("ack"))});
  size_t ackLength = cbor_serialize_alloc(ackMap, ackBuffer, ackBufferSize);
  memset(combinedTopic, 0, JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
  strcpy(combinedTopic, transmitter->topic[MQTT_PUB_C2J_DATA_ACK]);
  strcat(combinedTopic, idxCli);
  mqtt_publish(&(transmitter->client), combinedTopic, ackBuffer,
               ackBufferSize, JAMC_MQTT_QOS);
  mqtt_sync(&(transmitter->client));
  if (transmitter->client.error != MQTT_OK) {
    jamCall(CancelTransmitter(transmitter), 1);
    goto BeginPublishC2JDataAck;
  }
  free(ackBuffer);
  cbor_decref(&ackMap);
  jamCall(SetTaskData(currentTask, prevArg), 1);
  return 0;
}

static inline int WaitForAck(MQTTWaitObject *waitObject, struct timespec ts) {
  jamCall(ContextMutexLock(&(waitObject->mtxMQTTWait)), 1);
  if (unlikely(!waitObject->ready)) {
    jamCall(ContextConditionVariableWaitFor(&(waitObject->cvMQTTWait), &(waitObject->mtxMQTTWait), ts), 1);
  }
  jamCall(ContextMutexUnlock(&(waitObject->mtxMQTTWait)), 1);
  return 0;
}

static inline int SetUpJ2CDataSendAck(RemoteExecutionAttribute *attr) {
  memset(attr->dataAck.id, '\0', 42);
  sprintf(attr->dataAck.id, "%s-%08x", attr->uuid, attr->id);
  attr->dataAck.waitType = MQTT_WAIT_J2C_DATA_ACK;
  attr->dataAck.data = NULL;
  attr->dataAck.ready = 0;
  return 0;
}

static inline int SetUpC2JCallAck(MQTTC2JAttr *attr) {
  memset(attr->callAck.id, '\0', 42);
  sprintf(attr->callAck.id, "%s-%08x", selfUUID, attr->id);
  attr->callAck.waitType = MQTT_WAIT_C2J_CALL_ACK;
  attr->callAck.data = NULL;
  attr->callAck.ready = 0;
  return 0;
}
// gcc baseexecutor.c context.c funcreg.c list.c mqtt_manager.c mqtt_pal.c
// mqtt.c pqueue.c rtsched.c sync.c task_allocator.c timeout.c timer.c
// mqtt_test_caller.c -o mqtt_test_caller -lpthread -lcbor -lm -D_GNU_SOURCE
// -D__USE_XOPEN -D_XOPEN_SOURCE -ggdb
static inline int SetUpC2JDataRes(MQTTC2JAttr *attr) {
  memset(attr->dataAck.id, '\0', 42);
  sprintf(attr->dataAck.id, "%s-%08x", selfUUID, attr->id);
  attr->dataAck.waitType = MQTT_WAIT_C2J_DATA;
  attr->dataAck.data = NULL;
  attr->dataAck.ready = 0;
  return 0;
}

static inline int GetEmptyTransmitterFromLRUCache(MQTTDataTransmitter **txr) {
  MQTTDataTransmitter *leastRecentUsed = &lruCacheArrayThreadLocal[0];
  for (int i = 0; i < JAMC_MQTT_TXMTR_LRU_CACHE_SIZE; i++) {
    if (!(lruCacheArrayThreadLocal[i].used)) {
      lruCacheArrayThreadLocal[i].used = 1;
      *txr = &(lruCacheArrayThreadLocal[i]);
      return 0;
    }
    if (timespec_lt(lruCacheArrayThreadLocal[i].lastUsedTime,
                    leastRecentUsed->lastUsedTime)) {
      leastRecentUsed = &(lruCacheArrayThreadLocal[i]);
    }
  }
  jamCall(CancelTransmitter(leastRecentUsed), 1);
  leastRecentUsed->used = 1;
  *txr = leastRecentUsed;
  return 0;
}

static inline int GetConnectionByIPAndPort(MQTTDataTransmitter **tx,
                                           const char *ip, const char *uuid, int port) {
  for (int i = 0; i < JAMC_MQTT_TXMTR_LRU_CACHE_SIZE; i++) {
    if ((port == lruCacheArrayThreadLocal[i].port) &&
        (!strcmp(lruCacheArrayThreadLocal[i].ipAddr, ip)) &&
        (!strcmp(lruCacheArrayThreadLocal[i].uuid, uuid) &&
        (lruCacheArrayThreadLocal[i].used))) {
      *tx = &(lruCacheArrayThreadLocal[i]);
      return 0;
    }
  }
  *tx = NULL;
  return 0;
}

static inline int CASTaskDuplicated(int *isDup, const char *uuid,
                                    struct timespec dur, const uint32_t id) {
  struct timespec ts = {0, 0}, tsRes = {0, 0};
  DeduplicationTableEntry *res = NULL,
                          *actEnt = malloc(sizeof(DeduplicationTableEntry));
  *isDup = 1;
  memset(actEnt->cont, 0, 42);
  sprintf(actEnt->cont, "%s-%08x", uuid, id);
  jamCall(ContextMutexLock(&mtxDedupTable), 1);
  HASH_FIND_STR(deduplicationTable, actEnt->cont, res);
  if (!res) {
    HASH_ADD_STR(deduplicationTable, cont, actEnt);
    for (int i = 0; i < JAMC_MQTT_NUM_DE_RETRY; i++) {
      ts = timespec_add(ts, JAMC_MQTT_CALL_ACK_TIMEOUT);
    }
    for (int i = 0; i < (JAMC_MQTT_NUM_DE_RETRY - 1); i++) {
      ts = timespec_add(JAMC_MQTT_RESULT_TIMEOUT, timespec_add(ts, dur));
    }
    RelativeTimeToAbsoluteTimeTimeSpec(&tsRes, ts);
    timeout_init(&(actEnt->t), TIMEOUT_ABS);
    timeouts_add(&timerDedupTable, &(actEnt->t),
                 ConvertTimeSpecToNanoseconds(tsRes));
    *isDup = 0;
  } else {
    free(actEnt);
  }
  jamCall(ContextMutexUnlock(&mtxDedupTable), 1);
  return 0;
}

static inline int RemoveDeduplicateEntry(const char *uuid, const uint32_t id) {
  DeduplicationTableEntry *res = NULL, actEnt;
  memset(actEnt.cont, 0, 42);
  sprintf(actEnt.cont, "%s-%08x", uuid, id);
  jamCall(ContextMutexLock(&mtxDedupTable), 1);
  HASH_FIND_STR(deduplicationTable, actEnt.cont, res);
  if (res) {
    HASH_DEL(deduplicationTable, res);
    timeout_del(&(res->t));
    free(res);
  }
  jamCall(ContextMutexUnlock(&mtxDedupTable), 1);
  return 0;
}

static inline int ExpireDeduplicateEntries(void) {
  jamCall(ContextMutexLock(&mtxDedupTable), 1);
  struct timeout *tc = NULL;
  struct timespec now;
  Maintenant(&now);
  timeouts_update(&timerDedupTable, ConvertTimeSpecToNanoseconds(now));
  while ((tc = timeouts_get(&timerDedupTable))) {
    HASH_DEL(deduplicationTable, (DeduplicationTableEntry *)tc);
    free(tc);
  }
  //printf("table size %llu\n", HASH_COUNT(deduplicationTable));
  jamCall(ContextMutexUnlock(&mtxDedupTable), 1);
  return 0;
}

static void MQTTTransmitterCallback(void **unused,
                                    struct mqtt_response_publish *message) {
  TaskCommonHeader *currentTask;
  MQTTDataTransmitter *transmitter;
  MQTTWaitObject *waitObject = NULL;
  RemoteExecutionAttribute *reAttr = NULL;
  GetActiveTask(&currentTask);
  GetTaskData(&transmitter, currentTask);
  struct cbor_load_result result;
  cbor_item_t *item = cbor_load(message->application_message,
                                message->application_message_size, &result);
  if (item) {
    size_t numDeArticles = cbor_map_size(item);
    struct cbor_pair *mitems = cbor_map_handle(item);
    char idt[42];
    memset(idt, 0, 42);
    for (int i = 0; i < numDeArticles; i++) {
      if (!strncmp(cbor_string_handle(mitems[i].key), "id", 2)) {
        strncpy(idt, message->topic_name + 1, 32);
        sprintf(idt + 32, "-%08x", cbor_get_uint32(mitems[i].value));
        continue;
      }
    }
    if (!strncmp(message->topic_name + 67, JAMC_MQTT_CALL_ACK, 6)) {
      HASH_FIND_STR(transmitter->pendingRetries[MQTT_WAIT_C2J_CALL_ACK], idt, waitObject);
    }
    if (!strncmp(message->topic_name + 67, JAMC_MQTT_RES_DATA, 6)) {
      HASH_FIND_STR(transmitter->pendingRetries[MQTT_WAIT_C2J_DATA], idt, waitObject);
    }
    if (!strncmp(message->topic_name + 67, JAMC_MQTT_RES_ACK, 6)) {
      HASH_FIND_STR(transmitter->pendingRetries[MQTT_WAIT_J2C_DATA_ACK], idt, waitObject);
    }
    if (waitObject) {
      switch (waitObject->waitType) {
        case MQTT_WAIT_J2C_DATA_ACK:
          reAttr = (RemoteExecutionAttribute *)(waitObject);
          NotifyAckObject(transmitter, waitObject, 1);
          break;
        case MQTT_WAIT_C2J_DATA:
          ParseC2JDataRecv(item, waitObject);
          NotifyAckObject(transmitter, waitObject, 1);
          break;
        case MQTT_WAIT_C2J_CALL_ACK:
          ParseC2JAckRecv(item, waitObject);
          NotifyAckObject(transmitter, waitObject, 1);
          break;
        default:
          break;
      }
    }
    cbor_decref(&item);
  }
}

static void TransmitterPooler(void) {
  BeginTask();
  DisablePreemptionSignal();
  TaskCommonHeader *currentTask;
  MQTTDataTransmitter *transmitter;
  GetActiveTask(&currentTask);
  GetTaskData(&transmitter, currentTask);
  while (transmitter->used &&
         __atomic_load_n(&(currentTask->executor->schedulerManager->isRunning),
                         __ATOMIC_ACQUIRE)) {
    mqtt_sync(&(transmitter->client));
    CurrentTaskWaitFor(JAMC_MQTT_POOLER_SLEEP);
  }
  __builtin_trap();
}

static void TransmitterDefer(void *arg) { 
  CancelTransmitter(arg); 
}

static inline int CreateMQTTDataTransmitterTask(MQTTDataTransmitter *tx) {
  jamCall(CreateBatchTask(tx->poolerTask, CreateContext,
                          JAMC_MQTT_TRANSMITTER_STACK_SIZE, TransmitterPooler),
          1);
  jamCall(SetTaskData(tx->poolerTask, tx), 1);
  ((TaskCommonHeader *)(tx->poolerTask))->Defer = TransmitterDefer;
  ((TaskCommonHeader *)(tx->poolerTask))->deferArgs = tx;
  FixTaskToItsCore(tx->poolerTask);
  jamCall(EnableTaskOnCurrentExecutor(tx->poolerTask), 1);
  return 0;
}

static inline int ConnectMQTTToIPAndPort(MQTTDataTransmitter *tx,
                                         const char *ip, const char *uuid, int port) {
  TaskCommonHeader *currentTask;
  struct timespec now;
  void *prevArg;
  jamCall(GetActiveTask(&currentTask), 1);
  jamCall(GetTaskData(&prevArg, currentTask), 1);
  jamCall(SetTaskData(currentTask, tx), 1);
  tx->recvbuf = malloc(JAMC_MQTT_RECV_BUF_SIZE);
  tx->sendbuf = malloc(JAMC_MQTT_SEND_BUF_SIZE);
  tx->recvBufLen = JAMC_MQTT_RECV_BUF_SIZE;
  tx->sendBufLen = JAMC_MQTT_SEND_BUF_SIZE;
  memset(&(tx->client), 0, sizeof(struct mqtt_client));
  memset(tx->ipAddr, 0, JAMC_MQTT_HOST_IP_SIZE);
  strcpy(tx->ipAddr, ip);
  memset(tx->uuid, 0, 33);
  strcpy(tx->uuid, uuid);
  for (int i = 0; i < 6; i++) {
    if (i < 3) {
      tx->pendingRetries[i] = NULL;
      MQTTWaitObject *dummy = calloc(1, sizeof(MQTTWaitObject));
      sprintf(dummy->id, "dummyEntry");
      HASH_ADD_STR(tx->pendingRetries[i], id, dummy);
    }
    memset(tx->topic[i], '\0', JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
  }
  memset(tx->callTopic, '\0', JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
  tx->port = port;
  Maintenant(&tx->lastUsedTime);
  tx->sockfd = open_nb_socket(tx->ipAddr, tx->port);
  if (tx->sockfd == -1) {
    perror("Failed to open socket: ");
    jamCall(SetTaskData(currentTask, prevArg), 1);
    return 1;
  }
  /*mqtt_init(&(tx->client), tx->sockfd, tx->sendbuf, JAMC_MQTT_SEND_BUF_SIZE,
            tx->recvbuf, JAMC_MQTT_RECV_BUF_SIZE, MQTTTransmitterCallback);*/
  mqtt_init_reconnect(&(tx->client), ReconnectCallbackPooler, tx, MQTTTransmitterCallback);
  mqtt_connect(&(tx->client), NULL, NULL, NULL, 0, NULL, NULL,
               MQTT_CONNECT_CLEAN_SESSION, 400);
  mqtt_sync(&(tx->client));
  jamCall(SetTaskData(currentTask, prevArg), 1);
  jamCall(CreateMQTTDataTransmitterTask(tx), 1);
  return 0;
}

static int GetMQTTDataTransmitter(MQTTDataTransmitter **txr, const char *ip,
                                  const char *uuid, int port) {
  MQTTDataTransmitter *newConnection = NULL;
  GetConnectionByIPAndPort(&newConnection, ip, uuid, port);
  if (!newConnection) {
    jamCall(GetEmptyTransmitterFromLRUCache(&newConnection), 1);
    jamCall(ConnectMQTTToIPAndPort(newConnection, ip, uuid, port), 1);
  }
  *txr = newConnection;
  Maintenant(&newConnection->lastUsedTime);
  return 0;
}

static inline int SendResultBackToRemote(RemoteExecutionAttribute *attr) {
  int err = 0;
  void *prevArg;
  char combinedTopic[JAMC_MQTT_RPC_DATA_CHANNEL_SIZE], idxCli[5];
  JAMC_DISABLE_PREEMPTION_BEGIN;
  TaskCommonHeader *ctask;
  MQTTDataTransmitter *transmitter = NULL;
  GetActiveTask(&ctask);
  jamCallEnablePreemption(GetTaskData(&prevArg, ctask), 1);
  int prev = FixTaskToItsCore(ctask);
  jamCallEnablePreemption(BuildJ2CResult(attr), 1);
  jamCallEnablePreemption(SetUpJ2CDataSendAck(attr), 1);
  attr->dataAck.ready = 0;
  attr->dataAck.data = NULL;
  memset(idxCli, 0, 5);
  sprintf(idxCli, "/%u", attr->idx);
  jamCallEnablePreemption(CreateContextMutex(&(attr->dataAck.mtxMQTTWait)), 1);
  jamCallEnablePreemption(CreateContextConditionVariable(&(attr->dataAck.cvMQTTWait)), 1);
  for (int i = 0; i < JAMC_MQTT_NUM_DE_RETRY; i++) {
    MQTTWaitObject *resFound = NULL;
  BeginSendResultBackToRemote:
    resFound = NULL;
    jamCallEnablePreemption(GetMQTTDataTransmitter(&transmitter, attr->ipAddr, attr->uuid, attr->port), 1);
    jamCallEnablePreemption(SetTaskData(ctask, transmitter), 1);
    memset(combinedTopic, 0, JAMC_MQTT_RPC_DATA_CHANNEL_SIZE);
    strcpy(combinedTopic, transmitter->topic[MQTT_PUB_J2C_DATA]);
    strcat(combinedTopic, idxCli);
    HASH_FIND_STR(transmitter->pendingRetries[attr->dataAck.waitType], attr->dataAck.id, resFound);
    if (resFound == NULL) {
      HASH_ADD_STR(transmitter->pendingRetries[attr->dataAck.waitType], id, &(attr->dataAck));
      mqtt_publish(&(transmitter->client), combinedTopic,
                  attr->resBuffer, attr->resLength, JAMC_MQTT_QOS);
      mqtt_sync(&(transmitter->client));
      if (transmitter->client.error != MQTT_OK) {
        jamCallEnablePreemption(CancelTransmitter(transmitter), 1);
        goto BeginSendResultBackToRemote;
      }
    } else if (resFound != &(attr->dataAck)) {
      err = 1;
      break;
    } else {
      mqtt_publish(&(transmitter->client), combinedTopic,
                  attr->resBuffer, attr->resLength, JAMC_MQTT_QOS);
      mqtt_sync(&(transmitter->client));
      if (transmitter->client.error != MQTT_OK) {
        jamCallEnablePreemption(CancelTransmitter(transmitter), 1);
        goto BeginSendResultBackToRemote;
      }
    }
    WaitForAck(&(attr->dataAck), JAMC_MQTT_DATA_ACK_TIMEOUT);
    if (likely(attr->dataAck.ready == 1)) {
      break;
    }
  }
  MQTTWaitObject *found = NULL;
  jamCallEnablePreemption(GetMQTTDataTransmitter(&transmitter, attr->ipAddr, attr->uuid, attr->port), 1);
  HASH_FIND_STR(transmitter->pendingRetries[attr->dataAck.waitType], attr->dataAck.id, found);
  if (found == &(attr->dataAck)) {
    HASH_DEL(transmitter->pendingRetries[attr->dataAck.waitType], found);
    jamCallEnablePreemption(DestroyContextConditionVariable(&(attr->dataAck.cvMQTTWait)), 1);
  } else if (found && !err) {
    __builtin_trap();
  }
  UnFixTaskToItsCore(ctask, prev);
  free(attr->resBuffer);
  jamCallEnablePreemption(SetTaskData(ctask, prevArg), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static inline int SendErrorBackToRemote(RemoteExecutionAttribute *attr) {
  MQTTDataTransmitter *transmitter;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(PublishError(attr), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static inline int SendJ2CCallAckBackToRemote(RemoteExecutionAttribute *attr) {
  MQTTDataTransmitter *transmitter;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(PublishJ2CCallAck(attr), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static void RemoteWrapper(void) {
  TaskCommonHeader *currentTask;
  RemoteExecutionAttribute *tAttr;
  BeginTask();
  GetActiveTask(&currentTask);
  GetTaskData(&tAttr, currentTask);
  tAttr->taskFunction();
  FinishTask();
  __builtin_trap();
}

static __thread int magicId = 0;

static void RemoteTaskHandlerFunction(void) {
  BatchTaskHeader *currentTask;
  RemoteExecutionAttribute *tAttr;
  BeginTask();
  GetActiveTask(&currentTask);
  GetTaskData(&tAttr, currentTask);
  // int prevstats = FixTaskToItsCore(currentTask);
  switch (tAttr->type) {
    case JAMC_REXEC_BATCH:
      if (tAttr->taskContent.batchAttribute.runBatchTaskInRTThread) {
        if (currentTask->header.executor->schedulerManager->rtsyExecutor) {
          BatchTaskHeader *batchTask;
          AllocateBatchTask(&batchTask, tAttr->taskStackSize);
          CreateBatchTask(batchTask, CreateContext, tAttr->taskStackSize,
                          RemoteWrapper);
          batchTask->header.executor =
              currentTask->header.executor->schedulerManager->rtsyExecutor;
          SetTaskData(batchTask, tAttr);
          SendJ2CCallAckBackToRemote(tAttr);
          EnableTask(batchTask);
          WaitForTaskUntilFinish(batchTask);
          FreeBatchTask(batchTask);
          SendResultBackToRemote(tAttr);
        } else {
          SendErrorBackToRemote(tAttr);
        }
      } else {
        BatchTaskHeader *batchTask;
        AllocateBatchTask(&batchTask, tAttr->taskStackSize);
        CreateBatchTask(batchTask, CreateContext, tAttr->taskStackSize,
                        RemoteWrapper);
        SetTaskData(batchTask, tAttr);
        SendJ2CCallAckBackToRemote(tAttr);
        // FixTaskToItsCore(batchTask);
        EnableTaskOnExecutorWithMinimumNumberOfTask(batchTask,
        currentTask->header.executor->schedulerManager);
        //EnableTaskOnCurrentExecutor(batchTask);
        WaitForTaskUntilFinish(batchTask);
        FreeBatchTask(batchTask);
        SendResultBackToRemote(tAttr);
      }
      break;
    case JAMC_REXEC_RT:
      if (currentTask->header.executor->schedulerManager->rtsyExecutor) {
        RealTimeTaskHeader *rtTask;
        AllocateRTTask(&rtTask, tAttr->taskStackSize);
        CreateRTTask(&rtTask, tAttr->taskStackSize, RemoteWrapper,
                     tAttr->taskContent.rtAttribute.slotId);
        rtTask->header.executor =
            currentTask->header.executor->schedulerManager->rtsyExecutor;
        SetTaskData(rtTask, tAttr);
        SendJ2CCallAckBackToRemote(tAttr);
        EnableTask(rtTask);
        WaitForTaskUntilFinish(rtTask);
        FreeRTTask(rtTask);
        SendResultBackToRemote(tAttr);
      } else {
        SendErrorBackToRemote(tAttr);
      }
      break;
    case JAMC_REXEC_SYNC:
      if (currentTask->header.executor->schedulerManager->rtsyExecutor) {
        SyncBarrierTaskHeader *syTask;
        AllocateSYTask(&syTask, tAttr->taskStackSize);
        CreateSYTask(&syTask, tAttr->taskStackSize, RemoteWrapper, tAttr->uuid);
        syTask->header.executor =
            currentTask->header.executor->schedulerManager->rtsyExecutor;
        SetTaskData(syTask, tAttr);
        SendJ2CCallAckBackToRemote(tAttr);
        EnableTask(syTask);
        WaitForTaskUntilFinish(syTask);
        FreeSYTask(syTask);
        SendResultBackToRemote(tAttr);
      } else {
        SendErrorBackToRemote(tAttr);
      }
      break;
    case JAMC_REXEC_INTERACTIVE:
      if (currentTask->header.executor->schedulerManager->rtsyExecutor) {
        InteractiveTaskHeader *syTask;
        AllocateInteractiveTask(&syTask, tAttr->taskStackSize);
        CreateInteractiveTask(&syTask, tAttr->taskStackSize, RemoteWrapper,
                              tAttr->taskContent.interactiveAttribute.deadline);
        syTask->header.executor =
            currentTask->header.executor->schedulerManager->rtsyExecutor;
        SetTaskData(syTask, tAttr);
        SendJ2CCallAckBackToRemote(tAttr);
        EnableTask(syTask);
        WaitForTaskUntilFinish(syTask);
        FreeInteractiveTask(syTask);
        SendResultBackToRemote(tAttr);
      } else {
        SendErrorBackToRemote(tAttr);
      }
      break;
    default:
      break;
  }
  RemoveDeduplicateEntry(tAttr->uuid, tAttr->id);
  // UnFixTaskToItsCore(currentTask, prevstats);
  FinishTask();
  __builtin_trap();
}

static void RemoteTaskHandlerDefer(void *ptrTask) {
  RemoteExecutionAttribute *tAttr = ptrTask;
  if (tAttr->args) {
    cbor_decref(&(tAttr->args));
  }
  FreeRemoteTaskAttr(tAttr);
}

static void MQTTTaskLaunchSubscriberCallback(
    void **unused, struct mqtt_response_publish *message) {
  cbor_item_t *item = NULL;
  TaskCommonHeader *currentTask;
  MQTTTaskLaunchSubscriber *subscriber;
  struct cbor_load_result result;
  GetActiveTask(&currentTask);
  GetTaskData(&subscriber, currentTask);
  item = cbor_load(message->application_message,
                   message->application_message_size, &result);
  if (unlikely(!item)) {
    return;
  }
  if (!strncmp(message->topic_name + 33, JAMC_MQTT_TASK_CHANNEL, 9)) {
    int isDuplicatedCall;
    RemoteExecutionAttribute *tAttr;
    if (AllocateRemoteTaskAttr(&tAttr) || GetTaskAttribute(item, tAttr) ||
        CASTaskDuplicated(&isDuplicatedCall, tAttr->uuid, tAttr->dur, tAttr->id) ||
        isDuplicatedCall) {
      // cbor_describe(tAttr->args, stdout);
      // printf("isDuplicated=%d\n", isDuplicatedCall);
      FreeRemoteTaskAttr(tAttr);
      // cbor_decref(&item);
      return;
    }
    if (CreateBatchTask(tAttr->taskPointer, CreateCopyStackContext,
                        JAMC_MQTT_REMOTE_HANDLER_STACK_SIZE,
                        RemoteTaskHandlerFunction)) {
      perror("bad initn of batch task\n");
      FreeRemoteTaskAttr(tAttr);
      cbor_decref(&item);
      return;
    }
    ((TaskCommonHeader *)tAttr->taskPointer)->Defer = RemoteTaskHandlerDefer;
    ((TaskCommonHeader *)tAttr->taskPointer)->deferArgs = tAttr;
    tAttr->port = subscriber->port;
    strcpy(tAttr->ipAddr, subscriber->ipAddr);
    SetTaskData(tAttr->taskPointer, tAttr);
    // FixTaskToItsCore(tAttr->taskPointer);
    EnableTaskOnExecutorWithMinimumNumberOfTask(
        tAttr->taskPointer, currentTask->executor->schedulerManager);
    //EnableTaskOnCurrentExecutor(tAttr->taskPointer);
    cbor_decref(&item);
    return;
  }
  if (!strncmp(message->topic_name + 33, JAMC_MQTT_PING_PONG_CHANNEL, 9)) {
    Maintenant(&(subscriber->lastPingPongTime));
    cbor_decref(&item);
    return;
  }
  if (!strncmp(message->topic_name + 33, JAMC_MQTT_SUBSCRIPTION_CHANNEL, 9)) {
    size_t numDeArticles = cbor_map_size(item);
    if (numDeArticles) {
      struct cbor_pair *mitems = cbor_map_handle(item);
      for (size_t i = 0; i < numDeArticles; i++) {
        if (!strncmp(cbor_string_handle(mitems[i].key), "args", 4)) {
          void *task;
          int port;
          char uuid[33];
          char ipAddr[JAMC_MQTT_HOST_IP_SIZE];
          if (GetConnIPAddrAndPortFromPayload(mitems[i].value, ipAddr, &port,
                                              uuid) ||
              CreateMQTTTaskLaunchSubscriptionTask(&task, ipAddr, port, uuid)) {
            cbor_decref(&item);
            return;
          }
          EnableTaskOnCurrentExecutor(task);
          break;
        }
      }
    }
    cbor_decref(&item);
    return;
  }
  if (!strncmp(message->topic_name + 33, JAMC_MQTT_DISCONNECT_CHANNEL, 9)) {
    MQTTTaskLaunchSubscriber *subscriber;
    GetTaskData(&subscriber, currentTask);
    subscriber->isSubscribing = 0;
    cbor_decref(&item);
    return;
  }
  if (!strncmp(message->topic_name + 33, JAMC_MQTT_SCHEDULE_CHANNEL, 9)) {
    void *rtsyExecutor = ((BatchTaskHeader *)subscriber->poolerTask)->header.executor->schedulerManager->rtsyExecutor;
    if (rtsyExecutor) {
      ChangeSchedule(rtsyExecutor, item);
    }
    cbor_decref(&item);
    return;
  }
  cbor_decref(&item);
}

void ReconnectCallbackSubscriber(struct mqtt_client *client, void** state) {
  char topicNameBuf[JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE];
  MQTTTaskLaunchSubscriber *subscriber = *state;
  printf("reconnect called on subscriber\n");
  close(client->socketfd);
  subscriber->sockfd = open_nb_socket(subscriber->ipAddr, subscriber->port);
  subscriber->sendBufLen *= 2;
  subscriber->recvBufLen *= 2;
  free(subscriber->sendbuf);
  free(subscriber->recvbuf);
  subscriber->sendbuf = malloc(subscriber->sendBufLen);
  subscriber->recvbuf = malloc(subscriber->recvBufLen);
  mqtt_reinit(client, subscriber->sockfd, 
              subscriber->sendbuf, subscriber->sendBufLen, 
              subscriber->recvbuf, subscriber->recvBufLen);
  mqtt_connect(client, NULL, NULL, NULL, 0, NULL, NULL,
               MQTT_CONNECT_CLEAN_SESSION, 400);
  memset(topicNameBuf, 0, JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid, JAMC_MQTT_TASK_CHANNEL);
  mqtt_subscribe(&(subscriber->client), topicNameBuf, 0);
  memset(topicNameBuf, 0, JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid, JAMC_MQTT_PING_PONG_CHANNEL);
  mqtt_subscribe(&(subscriber->client), topicNameBuf, 0);
  memset(topicNameBuf, 0, JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid,
          JAMC_MQTT_SUBSCRIPTION_CHANNEL);
  mqtt_subscribe(&(subscriber->client), topicNameBuf, 0);
  memset(topicNameBuf, 0, JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid,
          JAMC_MQTT_DISCONNECT_CHANNEL);
  mqtt_subscribe(&(subscriber->client), topicNameBuf, 0);
  void *rtsyExecutor = ((BatchTaskHeader *)subscriber->poolerTask)->header.executor->schedulerManager->rtsyExecutor;
  if (rtsyExecutor && subscriber->subscribeSchedule) {
    memset(topicNameBuf, 0, JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE);
    sprintf(topicNameBuf, "/%s%s", subscriber->uuid,
            JAMC_MQTT_SCHEDULE_CHANNEL);
    mqtt_subscribe(&(subscriber->client), topicNameBuf, 0);
  }
}

static void MQTTTaskLaunchSubscriberPooler(void) {
  BeginTask();
  DisablePreemptionSignal();
  TaskCommonHeader *currentTask;
  MQTTTaskLaunchSubscriber *subscriber;
  char topicNameBuf[JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE];
  GetActiveTask(&currentTask);
  GetTaskData(&subscriber, currentTask);
  subscriber->sockfd = open_nb_socket(subscriber->ipAddr, subscriber->port);
  if (subscriber->sockfd == -1) {
    perror("Failed to open socket: ");
    FinishTask();
    return;
  }
  memset(&(subscriber->client), 0, sizeof(struct mqtt_client));
  subscriber->client.error = MQTT_OK;
  subscriber->recvbuf = aligned_alloc(32, JAMC_MQTT_RECV_BUF_SIZE);
  subscriber->sendbuf = aligned_alloc(32, JAMC_MQTT_SEND_BUF_SIZE);
  subscriber->recvBufLen = JAMC_MQTT_RECV_BUF_SIZE;
  subscriber->sendBufLen = JAMC_MQTT_SEND_BUF_SIZE;
  subscriber->isSubscribing = 1;
  Maintenant(&(subscriber->lastPingPongTime));
  mqtt_init_reconnect(&(subscriber->client), ReconnectCallbackSubscriber, subscriber, MQTTTaskLaunchSubscriberCallback);
  mqtt_connect(&(subscriber->client), NULL, NULL, NULL, 0, NULL, NULL,
               MQTT_CONNECT_CLEAN_SESSION, 400);
  mqtt_sync(&(subscriber->client));
  /*if (subscriber->client.error != MQTT_OK) {
    fprintf(stderr, "error: %s\n", mqtt_error_str(subscriber->client.error));
    __builtin_trap();
    return;
  }*/
  int iDedupWait = 0;
  while (subscriber->isSubscribing) {
    struct timespec now;
    mqtt_sync(&(subscriber->client));
    Maintenant(&now);
    /*if (timespec_gt(now, timespec_add(subscriber->lastPingPongTime,
                                      JAMC_MQTT_PING_PONG_EXPIRE))) {
      break;
    }*/
    CurrentTaskWaitFor(JAMC_MQTT_POOLER_SLEEP);
    ExpireDeduplicateEntries();
  }
  printf("aaaaa\n");
  memset(topicNameBuf, 0, 42);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid, JAMC_MQTT_TASK_CHANNEL);
  mqtt_unsubscribe(&(subscriber->client), topicNameBuf);
  memset(topicNameBuf, 0, 42);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid, JAMC_MQTT_PING_PONG_CHANNEL);
  mqtt_unsubscribe(&(subscriber->client), topicNameBuf);
  memset(topicNameBuf, 0, 42);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid,
          JAMC_MQTT_SUBSCRIPTION_CHANNEL);
  mqtt_unsubscribe(&(subscriber->client), topicNameBuf);
  memset(topicNameBuf, 0, 42);
  sprintf(topicNameBuf, "/%s%s", subscriber->uuid,
          JAMC_MQTT_DISCONNECT_CHANNEL);
  mqtt_unsubscribe(&(subscriber->client), topicNameBuf);
  mqtt_disconnect(&(subscriber->client));
  mqtt_sync(&(subscriber->client));
  void *rtsyExecutor = ((BatchTaskHeader *)subscriber->poolerTask)->header.executor->schedulerManager->rtsyExecutor;
  if (rtsyExecutor) {
    if (subscriber->subscribeSchedule) {
      memset(topicNameBuf, 0, JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE);
      sprintf(topicNameBuf, "/%s%s", subscriber->uuid,
              JAMC_MQTT_SCHEDULE_CHANNEL);
      mqtt_subscribe(&(subscriber->client), topicNameBuf, 0);
    }
    while (DeleteController(rtsyExecutor, subscriber->uuid)) {
      CurrentTaskWaitFor(JAMC_MQTT_POOLER_SLEEP);
    }
  }
  FinishTask();
}

static void MQTTTaskLaunchSubscriberPoolerDefer(void *_subscriber) {
  close(((MQTTTaskLaunchSubscriber *)_subscriber)->sockfd);
  free(((MQTTTaskLaunchSubscriber *)_subscriber)->sendbuf);
  free(((MQTTTaskLaunchSubscriber *)_subscriber)->recvbuf);
  FreeMQTTTaskLaunchSubscriber(_subscriber);
}

int CreateMQTTTaskLaunchSubscriptionTask(void **pTask, const char *ipAddr,
                                         int port, const char *uuid) {
  MQTTTaskLaunchSubscriber *subscriber;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(AllocateMQTTTaskLaunchSubscriber(&subscriber), 1);
  memset(subscriber->ipAddr, 0, JAMC_MQTT_HOST_IP_SIZE);
  strcpy(subscriber->ipAddr, ipAddr);
  subscriber->port = port;
  strcpy(subscriber->uuid, uuid);
  jamCallEnablePreemption(CreateBatchTask(subscriber->poolerTask, CreateContext,
                                          JAMC_MQTT_SUBSCRIBER_STACK_SIZE,
                                          MQTTTaskLaunchSubscriberPooler),
                          1);
  jamCallEnablePreemption(SetTaskData(&(subscriber->poolerTask), subscriber),
                          1);
  TaskCommonHeader *tSubscriber = subscriber->poolerTask;
  tSubscriber->Defer = MQTTTaskLaunchSubscriberPoolerDefer;
  tSubscriber->deferArgs = subscriber;
  *pTask = tSubscriber;
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int CreateMQTTTaskLaunchSubscriptionTask2(void **pTask, const char *ipAddr,
                                          int port, const char *uuid) {
  MQTTTaskLaunchSubscriber *subscriber;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(AllocateMQTTTaskLaunchSubscriber(&subscriber), 1);
  memset(subscriber->ipAddr, 0, JAMC_MQTT_HOST_IP_SIZE);
  strcpy(subscriber->ipAddr, ipAddr);
  subscriber->port = port;
  strcpy(subscriber->uuid, uuid);
  jamCallEnablePreemption(CreateBatchTask(subscriber->poolerTask, CreateContext,
                                          JAMC_MQTT_SUBSCRIBER_STACK_SIZE,
                                          MQTTTaskLaunchSubscriberPooler),
                          1);
  jamCallEnablePreemption(SetTaskData(&(subscriber->poolerTask), subscriber),
                          1);
  TaskCommonHeader *tSubscriber = subscriber->poolerTask;
  tSubscriber->Defer = MQTTTaskLaunchSubscriberPoolerDefer;
  tSubscriber->deferArgs = subscriber;
  *pTask = subscriber;
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int CallControllerFunction(const char *functionName, cbor_item_t *arg,
                           const char *ipAddr, int port, const char *uuid,
                           cbor_item_t **result, void (*SentCallBack)(void *), void *sentArg, void (*CallAckCallBack)(void *), void *callAckArg) {
  int err = 0;
  void *prevArg;
  MQTTC2JAttr *mqttC2JAttr;
  TaskCommonHeader *ctask;
  MQTTDataTransmitter *transmitter = NULL;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  GetActiveTask(&ctask);
  jamCall(GetTaskData(&prevArg, ctask), 1);
  int prev = FixTaskToItsCore(ctask);
  jamCallEnablePreemption(AllocateMQTTC2JAttr(&mqttC2JAttr), 1);
  mqttC2JAttr->args = cbor_copy(arg);
  mqttC2JAttr->id = __atomic_fetch_add(&idGenerator, 1, __ATOMIC_ACQ_REL);
  mqttC2JAttr->port = port;
  mqttC2JAttr->dur = (struct timespec){0, 0};
  memset(mqttC2JAttr->ipAddr, 0, JAMC_MQTT_HOST_IP_SIZE);
  strcpy(mqttC2JAttr->ipAddr, ipAddr);
  strcpy(mqttC2JAttr->uuid, uuid);
  strcpy(mqttC2JAttr->funcName, functionName);
  jamCallEnablePreemption(BuildC2JArgs(mqttC2JAttr), 1);
  jamCallEnablePreemption(SetUpC2JCallAck(mqttC2JAttr), 1);
  jamCallEnablePreemption(SetUpC2JDataRes(mqttC2JAttr), 1);
  mqttC2JAttr->callAck.ready = 0;
  mqttC2JAttr->callAck.data = NULL;
  memset(&(mqttC2JAttr->callAck.hh), 0, sizeof(UT_hash_handle));
  jamCall(CreateContextMutex(&(mqttC2JAttr->callAck.mtxMQTTWait)), 1);
  jamCall(CreateContextConditionVariable(&(mqttC2JAttr->callAck.cvMQTTWait)), 1);
  mqttC2JAttr->dataAck.ready = 0;
  mqttC2JAttr->dataAck.data = NULL;
  memset(&(mqttC2JAttr->dataAck.hh), 0, sizeof(UT_hash_handle));
  jamCall(CreateContextMutex(&(mqttC2JAttr->dataAck.mtxMQTTWait)), 1);
  jamCall(CreateContextConditionVariable(&(mqttC2JAttr->dataAck.cvMQTTWait)), 1);
  for (int i = 0; i < JAMC_MQTT_NUM_DE_RETRY * 2; ) {
    MQTTWaitObject *resFound = NULL, *resFound1 = NULL;
    int isSameTx;
  BeginCallControllerFunction:
    resFound = NULL;
    resFound1 = NULL;
    jamCall(GetMQTTDataTransmitter(&transmitter, ipAddr, uuid, port), 1);
    jamCall(SetTaskData(ctask, transmitter), 1);
    HASH_FIND_STR(transmitter->pendingRetries[mqttC2JAttr->callAck.waitType], mqttC2JAttr->callAck.id, resFound);
    HASH_FIND_STR(transmitter->pendingRetries[mqttC2JAttr->dataAck.waitType], mqttC2JAttr->dataAck.id, resFound1);
    if (resFound == NULL && resFound1 == NULL) {
      HASH_ADD_STR(transmitter->pendingRetries[mqttC2JAttr->callAck.waitType], id, &(mqttC2JAttr->callAck));
      HASH_ADD_STR(transmitter->pendingRetries[mqttC2JAttr->dataAck.waitType], id, &(mqttC2JAttr->dataAck));
      mqtt_publish(&(transmitter->client), transmitter->callTopic,
                  mqttC2JAttr->argBuffer, mqttC2JAttr->argActLen, JAMC_MQTT_QOS);
      mqtt_sync(&(transmitter->client));
      if (transmitter->client.error != MQTT_OK) {
        jamCall(CancelTransmitter(transmitter), 1);
        goto BeginCallControllerFunction;
      }
    } else if (resFound != &(mqttC2JAttr->callAck) && resFound1 != &(mqttC2JAttr->dataAck)) {
      err = 1;
      break;
    } else if (resFound == &(mqttC2JAttr->callAck) && resFound1 == &(mqttC2JAttr->dataAck)) {
      mqtt_publish(&(transmitter->client), transmitter->callTopic,
                  mqttC2JAttr->argBuffer, mqttC2JAttr->argActLen, JAMC_MQTT_QOS);
      mqtt_sync(&(transmitter->client));
      if (transmitter->client.error != MQTT_OK) {
        jamCall(CancelTransmitter(transmitter), 1);
        goto BeginCallControllerFunction;
      }
    } else {
      printf("nround %d, resFound=%p, resFound1=%p, callAck=%p, dataAck=%p\n", i, resFound, resFound1, &(mqttC2JAttr->callAck), &(mqttC2JAttr->dataAck));
      // __builtin_trap();
    }
    if (i == 0 && SentCallBack) {
      SentCallBack(sentArg);
    }
    if (i < JAMC_MQTT_NUM_DE_RETRY) {
      WaitForAck(&(mqttC2JAttr->callAck), JAMC_MQTT_CALL_ACK_TIMEOUT);
      if (likely(mqttC2JAttr->callAck.ready == 1)) {
        i = JAMC_MQTT_NUM_DE_RETRY;
        if (CallAckCallBack) {
          CallAckCallBack(callAckArg);
        }
        continue;
      }
      if (unlikely((i == (JAMC_MQTT_NUM_DE_RETRY - 1)) && (mqttC2JAttr->callAck.ready != 1))) {
        break;
      }
    } else {
      WaitForAck(&(mqttC2JAttr->dataAck), timespec_add(JAMC_MQTT_RESULT_TIMEOUT, mqttC2JAttr->dur));
      if (likely(mqttC2JAttr->dataAck.ready == 1)) {
        break;
      }
    }
    i = i + 1;
  }
  MQTTWaitObject *found = NULL, *found1 = NULL;
  jamCall(GetMQTTDataTransmitter(&transmitter, mqttC2JAttr->ipAddr, mqttC2JAttr->uuid, mqttC2JAttr->port), 1);
  HASH_FIND_STR(transmitter->pendingRetries[mqttC2JAttr->callAck.waitType], mqttC2JAttr->callAck.id, found);
  HASH_FIND_STR(transmitter->pendingRetries[mqttC2JAttr->dataAck.waitType], mqttC2JAttr->dataAck.id, found1);
  if (found == &(mqttC2JAttr->callAck) && found1 == &(mqttC2JAttr->dataAck)) {
    HASH_DEL(transmitter->pendingRetries[mqttC2JAttr->callAck.waitType], found);
    HASH_DEL(transmitter->pendingRetries[mqttC2JAttr->dataAck.waitType], found1);
    jamCallEnablePreemption(DestroyContextConditionVariable(&(mqttC2JAttr->callAck.cvMQTTWait)), 1);
    jamCallEnablePreemption(DestroyContextConditionVariable(&(mqttC2JAttr->dataAck.cvMQTTWait)), 1);
  } else if ((found || found1) && !err) {
    __builtin_trap();
  }
  if (mqttC2JAttr->dataAck.ready == 1) {
    PublishC2JDataAck(mqttC2JAttr);
  }
  *result = mqttC2JAttr->dataAck.data;
  jamCallEnablePreemption(FreeMQTTC2JAttr(mqttC2JAttr), 1);
  UnFixTaskToItsCore(ctask, prev);
  free(mqttC2JAttr->argBuffer);
  jamCall(SetTaskData(ctask, prevArg), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int InitCallEnv(const char *uuid) {
  struct timespec now;
  Maintenant(&now);
  strcpy(selfUUID, uuid);
  timeouts_init(&timerDedupTable, 0);
  timeouts_update(&timerDedupTable, ConvertTimeSpecToNanoseconds(now));
  CreateContextMutex(&mtxDedupTable);
  return 0;
}

size_t GetDeduplicationTableSize() {
  size_t sz = 0;
  //printf("next update %llu \n", timeouts_timeout(&timerDedupTable));
  sz = HASH_COUNT(deduplicationTable);
  
  return sz;
}
