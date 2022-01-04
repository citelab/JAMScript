#pragma once
#include <cbor.h>
#include "config.h"
#include "baseexecutor.h"
#include "uthash.h"
#include "mqtt.h"

typedef enum __TaskType {
  JAMC_REXEC_BATCH = 0,
  JAMC_REXEC_RT = 1,
  JAMC_REXEC_SYNC = 2,
  JAMC_REXEC_INTERACTIVE = 3, 
  JAMC_REXEC_ERROR_TYPE = 4
} TaskType;

typedef struct __MQTTTaskLaunchSubscriber {
  DeclBatchTask(poolerTask, JAMC_MQTT_SUBSCRIBER_STACK_SIZE);
  char uuid[33];
  struct mqtt_client client;
  struct timespec lastPingPongTime;
  unsigned char *sendbuf, *recvbuf;
  size_t sendBufLen, recvBufLen;
  //unsigned char sendbuf[JAMC_MQTT_SEND_BUF_SIZE] __attribute__((aligned(32)));
  //unsigned char recvbuf[JAMC_MQTT_RECV_BUF_SIZE] __attribute__((aligned(32)));
  char ipAddr[JAMC_MQTT_HOST_IP_SIZE];
  int isSubscribing, sockfd, port, subscribeSchedule;
} MQTTTaskLaunchSubscriber;

typedef enum __MQTTWaitType {
  MQTT_WAIT_C2J_CALL_ACK = 0,
  MQTT_WAIT_C2J_DATA, // resData
  MQTT_WAIT_J2C_DATA_ACK, // resAck
} MQTTWaitType;

typedef enum __MQTTSendType {
  MQTT_PUB_J2C_CALL_ACK = MQTT_WAIT_J2C_DATA_ACK + 1,
  MQTT_PUB_J2C_DATA, // resData
  MQTT_PUB_C2J_DATA_ACK, // resAck
} MQTTSendType;

typedef struct __MQTTWaitObject {
  int ready;
  cbor_item_t *data;  // should be freed by user after retrieval using FreeBytes(data);
  char id[JAMC_MQTT_RPC_MAP_ID_SIZE];
  MQTTWaitType waitType;
  ContextMutex mtxMQTTWait;
  ContextConditionVariable cvMQTTWait;
  UT_hash_handle hh;
} MQTTWaitObject;

typedef struct __RemoteExecutionAttribute {
  MQTTWaitObject dataAck;
  TaskType type;               // from payload
  void (*taskFunction)(void);  // from payload
  cbor_item_t *args, *result, *resMap;  // args from payload, result should be allocated by
                        // AllocateBytes(result)
  size_t taskStackSize;  // args from payload
  char ipAddr[JAMC_MQTT_HOST_IP_SIZE];
  char sendBackTopicName[JAMC_MQTT_RPC_DATA_CHANNEL_SIZE];
  char uuid[33];
  uint32_t id, idx;       // from payload
  size_t resBufferSize, resLength;
  struct timespec dur;
  unsigned char resBuffer[1024];
  int port;
  DeclBatchTask(taskPointer, JAMC_MQTT_REMOTE_HANDLER_STACK_SIZE);
  union {
    struct {
      uint16_t slotId;
    } rtAttribute;
    struct {
      struct timespec deadline;
    } interactiveAttribute;
    struct {
      int runBatchTaskInRTThread;
    } batchAttribute;
  } taskContent;
} RemoteExecutionAttribute;

typedef struct __MQTTDataTransmitter {
  char uuid[33];
  struct mqtt_client client;
  struct timespec lastUsedTime;
  unsigned char *sendbuf, *recvbuf;
  size_t sendBufLen, recvBufLen;
  //unsigned char sendbuf[JAMC_MQTT_SEND_BUF_SIZE] __attribute__((aligned(32)));
  //unsigned char recvbuf[JAMC_MQTT_RECV_BUF_SIZE] __attribute__((aligned(32)));
  char ipAddr[JAMC_MQTT_HOST_IP_SIZE];
  char topic[6][JAMC_MQTT_RPC_DATA_CHANNEL_SIZE];
  char callTopic[JAMC_MQTT_RPC_DATA_CHANNEL_SIZE];
  int sockfd, port, used;
  DeclBatchTask(poolerTask, JAMC_MQTT_TRANSMITTER_STACK_SIZE);
  MQTTWaitObject *pendingRetries[3];  // init to NULL
} MQTTDataTransmitter;

typedef struct __MQTTC2JAttr {
  MQTTWaitObject dataAck, callAck;
  int port;
  unsigned char *argBuffer;
  size_t argBufLen, argActLen;
  cbor_item_t *args;  // managed by user
  uint32_t id, idx;
  struct timespec dur;
  char uuid[33];
  char ipAddr[JAMC_MQTT_HOST_IP_SIZE];
  char funcName[JAMC_MQTT_RPC_MAX_FUNC_NAME_SIZE];
} MQTTC2JAttr;

int CreateMQTTTaskLaunchSubscriptionTask(void **pTask, const char *ipAddr,
                                         int port, const char *uuid);
int CreateMQTTTaskLaunchSubscriptionTask2(void **pTask, const char *ipAddr,
                                          int port, const char *uuid);
// copy constructs arg, please cbor_decref result after use
int CallControllerFunction(const char *functionName, cbor_item_t *arg,
                           const char *ipAddr, int port, const char *uuid, 
                           cbor_item_t **result, void (*SentCallBack)(void *), void* sentArg, void (*CallAckCallBack)(void *), void* callArg);
int InitCallEnv(const char *uuid);
size_t GetDeduplicationTableSize();