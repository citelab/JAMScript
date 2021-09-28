#include "task_allocator.h"

#include <stdlib.h>



int AllocateRTTask(RealTimeTaskHeader **ptr, size_t ssz) {
  *ptr = malloc(sizeof(RealTimeTaskHeader) + ssz);
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeRTTask(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateSYTask(SyncBarrierTaskHeader **ptr, size_t ssz) {
  *ptr = malloc(sizeof(SyncBarrierTaskHeader) + ssz);
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeSYTask(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateBatchTask(BatchTaskHeader **ptr, size_t ssz) {
  *ptr = malloc(sizeof(BatchTaskHeader) + ssz);
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeBatchTask(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateInteractiveTask(InteractiveTaskHeader **ptr, size_t ssz) {
  *ptr = malloc(sizeof(InteractiveTaskHeader) + ssz);
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeInteractiveTask(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateRemoteTaskAttr(RemoteExecutionAttribute **ptr) {
  *ptr = calloc(1, sizeof(RemoteExecutionAttribute));
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeRemoteTaskAttr(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateBytes(void **ptr, size_t sz) {
  *ptr = malloc(sz);
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeBytes(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateMQTTTaskLaunchSubscriber(MQTTTaskLaunchSubscriber **ptr) {
  *ptr = malloc(sizeof(MQTTTaskLaunchSubscriber));
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeMQTTTaskLaunchSubscriber(void *ptr) {
  free(ptr);
  return 0;
}

int AllocateMQTTC2JAttr(MQTTC2JAttr **ptr) {
  *ptr = malloc(sizeof(MQTTC2JAttr));
  if (unlikely(!ptr)) return 1;
  return 0;
}

int FreeMQTTC2JAttr(void *ptr) {
  free(ptr);
  return 0;
}