#pragma once
#include <stdint.h>
#include "baseexecutor.h"
#include "mqtt_manager.h"
int AllocateRTTask(RealTimeTaskHeader **ptr, size_t ssz);
int FreeRTTask(void *);
int AllocateSYTask(SyncBarrierTaskHeader **ptr, size_t ssz);
int FreeSYTask(void *);
int AllocateBatchTask(BatchTaskHeader **ptr, size_t ssz);
int FreeBatchTask(void *);
int AllocateInteractiveTask(InteractiveTaskHeader **ptr, size_t ssz);
int FreeInteractiveTask(void *);
int AllocateRemoteTaskAttr(RemoteExecutionAttribute **ptr);
int FreeRemoteTaskAttr(void *);
int AllocateBytes(void **ptr, size_t sz);
int FreeBytes(void *);
int AllocateMQTTTaskLaunchSubscriber(MQTTTaskLaunchSubscriber **ptr);
int FreeMQTTTaskLaunchSubscriber(void *);
int AllocateMQTTC2JAttr(MQTTC2JAttr **ptr);
int FreeMQTTC2JAttr(void *);