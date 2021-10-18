#pragma once
#include "baseexecutor.h"
#include "pqueue.h"
#include "mqtt.h"
#include <stdint.h>

#define MAX_SLOT_LEN 32

typedef enum __ScheduleType {
  SCHED_EMPTY = 0, SCHED_RT, SCHED_SY, SCHED_BI
} ScheduleType;

typedef struct __RTSYScheduleItem {
  ScheduleType type;
  uint64_t duration;
  uint64_t id;
  double rewardThreshold;
} RTSYScheduleItem;

typedef struct __RTSYSchedule {
  uint64_t probeLength, execLength, probeSlotDuration;
  RTSYScheduleItem slots[MAX_SLOT_LEN];
} RTSYSchedule;

typedef struct __RTSYTableEntry {
  PlatformMutex mtxRTSYEntry;
  List rtsyQueue;
  int syncClaimedControllerIndex;
} RTSYTableEntry;

typedef struct __RTSYControllerRepresentation {
  SyncBarrierTaskHeader *syncTask;
  char ipAddr[16];
  char uuid[33];
  double reward;
  int port, used, slotClaimed, decision, isBIDRequestionFinished; // for architecutres not supporting atomic OP on 128bits
} RTSYControllerRepresentation;

typedef struct __RTSYExecutor {
  BaseTaskExecutor baseTaskExecutor;
  PlatformMutex mtxInteractivePrQueue, mtxSchedule, mtxControllerPool, mtxConnBuf, mtxDeleteBuf;
  PQueue interactivePrQueue;
  RTSYSchedule rtsySchedule, newSchedule;
  RTSYTableEntry rtsySlots[MAX_SLOT_LEN];
  RTSYControllerRepresentation controllerPool[MAX_SLOT_LEN];
  char removalPool[MAX_SLOT_LEN][33];
  struct { char uuid[33], ipAddr[16]; int port; } connPool[MAX_SLOT_LEN];
  uint64_t batchVclk, interactiveVclk, syncVclk, preemptAt, currSlotIdx;
  struct timespec jitterMeasureTime;
  double actualMaximizedReward[MAX_SLOT_LEN];
  int decisions[MAX_SLOT_LEN], claimCounts[MAX_SLOT_LEN][2], removalPoolWatermark, connPoolWatermark, connNewCap;
} RTSYExecutor;

int CreateRTTask(void *lpTask, unsigned long stackSize, void (*fn)(void), uint16_t slot);
int CreateSYTask(void *lpTask, unsigned long stackSize, void (*fn)(void), const char *controllerId);
int CreateInteractiveTask(void *lpTask, unsigned long stackSize, void (*fn)(void), struct timespec deadline);
int ConnectPrimaryController(void *rtep, const char *ipAddr, int port, const char *uuid);
int DeleteController(void *rtep, const char *uuid);
int ConnectToController(void *rtep, const char *ipAddr, int port, const char *uuid);
int ChangeSchedule(void *rtep, cbor_item_t *unparsed);