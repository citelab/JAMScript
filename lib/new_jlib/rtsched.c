#include "mqtt_manager.h"
#include "rtsyched.h"
#include "task_allocator.h"
#include "baseexecutor.h"

typedef struct __JAMScriptUserContext {
  JAMC_USER_CONTEXT_MEMBERS
  unsigned char stack[];
} JAMScriptUserContext;

typedef struct _BatchTask {
  JAMC_USER_BATCH_MEMBERS
  JAMScriptUserContext ctx;
} BatchTask;

typedef struct _TaskRT {
  JAMC_USER_RT_MEMBERS
  JAMScriptUserContext ctx;
} RealTimeTask;

typedef struct _TaskIT {
  JAMC_USER_IT_MEMBERS
  JAMScriptUserContext ctx;
} InteractiveTask;

typedef struct _TaskSB {
  JAMC_USER_SB_MEMBERS
  JAMScriptUserContext ctx;
} SyncBarrierTask;

static __thread RTSYExecutor threadRTSYExecutor;

static int NextTaskRTSYExecutorImpl(void) {
  jamCall(ContextSwitchToTask(NULL), 1);
}

static int EnableTaskRTSYExecutorImpl(void *_task) {
  TaskCommonHeader *task = _task;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  if (task->isBatchTask) {
    BaseTaskExecutor *baseTaskExecutor = task->executor;
    jamCall(PlatformMutexLock(&(baseTaskExecutor->mtxReadyQueue)), 1);
    list_insert_front(&(baseTaskExecutor->readyQueue), (ListNode *)task);
    jamCall(PlatformMutexUnlock(&(baseTaskExecutor->mtxReadyQueue)), 1);
  } else if (task->isInteractiveTask) {
    RTSYExecutor *rtsyTaskExecutor = task->executor;
    jamCall(PlatformMutexLock(&(rtsyTaskExecutor->mtxInteractivePrQueue)), 1);
    pqueue_insert(&(rtsyTaskExecutor->interactivePrQueue), task);
    jamCall(PlatformMutexUnlock(&(rtsyTaskExecutor->mtxInteractivePrQueue)), 1);
  } else if (task->isRealTimeTask) {
    RealTimeTask *rtTask = task;
    RTSYExecutor *rtsyTaskExecutor = task->executor;
    jamCall(PlatformMutexLock(
                &(rtsyTaskExecutor->rtsySlots[rtTask->slotId].mtxRTSYEntry)),
            1);
    list_insert_back(&(rtsyTaskExecutor->rtsySlots[rtTask->slotId].rtsyQueue),
                     (ListNode *)rtTask);
    jamCall(PlatformMutexUnlock(
                &(rtsyTaskExecutor->rtsySlots[rtTask->slotId].mtxRTSYEntry)),
            1);
  } else if (task->isSyncBarrierTask) {
    SyncBarrierTask *syTask = task, *nullCmp = NULL;
    RTSYExecutor *rtsyTaskExecutor = task->executor;
    for (int i = 0; i < MAX_SLOT_LEN; i++) {
      if (!strcmp(syTask->controllerUuid,
                  rtsyTaskExecutor->controllerPool[i].uuid)) {
        int ret = __atomic_compare_exchange_n(
            &(rtsyTaskExecutor->controllerPool[i].syncTask), &(nullCmp), syTask,
            0, __ATOMIC_ACQ_REL, __ATOMIC_ACQUIRE);
        JAMC_DISABLE_PREEMPTION_END;
        return !ret;
      }
      if (i == MAX_SLOT_LEN - 1) {
        JAMC_DISABLE_PREEMPTION_END;
        return 1;
      }
    }
  } else {
    JAMC_DISABLE_PREEMPTION_END;
    return 1;
  }
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static int CleanupPreviousTaskRTSYExecutorImpl(void) {
  return CleanupPreviousTaskBaseExecutorImpl();
}

static inline int GetSlackServerTask(TaskCommonHeader *toExec) {
  toExec = NULL;
  jamCall(PlatformMutexLock(&(threadRTSYExecutor.mtxInteractivePrQueue)), 1);
  jamCall(
      PlatformMutexLock(&(threadRTSYExecutor.baseTaskExecutor.mtxReadyQueue)),
      1);
  if (list_size(&threadRTSYExecutor.baseTaskExecutor.readyQueue) &&
      !pqueue_size(&(threadRTSYExecutor.interactivePrQueue))) {
    toExec = list_front(&(threadRTSYExecutor.baseTaskExecutor.readyQueue));
    list_remove_front(&(threadRTSYExecutor.baseTaskExecutor.readyQueue));
  }
  if (!list_size(&threadRTSYExecutor.baseTaskExecutor.readyQueue) &&
      pqueue_size(&(threadRTSYExecutor.interactivePrQueue))) {
    jamCall(pqueue_extract(&(threadRTSYExecutor.interactivePrQueue), &toExec),
            1);
  }
  if (list_size(&threadRTSYExecutor.baseTaskExecutor.readyQueue) &&
      pqueue_size(&(threadRTSYExecutor.interactivePrQueue))) {
    if (threadRTSYExecutor.batchVclk < threadRTSYExecutor.interactiveVclk) {
      toExec = list_front(&(threadRTSYExecutor.baseTaskExecutor.readyQueue));
      list_remove_front(&(threadRTSYExecutor.baseTaskExecutor.readyQueue));
    } else {
      jamCall(pqueue_extract(&(threadRTSYExecutor.interactivePrQueue), &toExec),
              1);
    }
  }
  jamCall(
      PlatformMutexUnlock(&(threadRTSYExecutor.baseTaskExecutor.mtxReadyQueue)),
      1);
  jamCall(PlatformMutexUnlock(&(threadRTSYExecutor.mtxInteractivePrQueue)), 1);
  return 0;
}

static inline void SchedulePreemptAt(struct timespec preemptTime) {
  __atomic_store_n(&(threadRTSYExecutor.preemptAt),
                   ConvertTimeSpecToNanoseconds(preemptTime), __ATOMIC_RELEASE);
}

static inline void CancelPreempt() {
  __atomic_store_n(&(threadRTSYExecutor.preemptAt), 0, __ATOMIC_RELEASE);
}

static inline int ExecuteSlackServer(void) {
  struct timespec st, ed, kSleepIfNoTask = JAMC_SLEEP_IF_NO_TASK;
  TaskCommonHeader *toExec;
  jamCall(GetSlackServerTask(&toExec), 1);
  if (toExec) {
    jamCall(Maintenant(&st), 1);
    jamCall(ContextSwitchToTask(toExec), 1);
    jamCall(Maintenant(&ed), 1);
    if (toExec->isBatchTask) {
      threadRTSYExecutor.batchVclk +=
          ConvertTimeSpecToNanoseconds(timespec_sub(ed, st));
    }
    if (toExec->isInteractiveTask) {
      threadRTSYExecutor.interactiveVclk +=
          ConvertTimeSpecToNanoseconds(timespec_sub(ed, st));
    }
  } else {
    PlatformSleep(&kSleepIfNoTask);
  }
  return 0;
}

static inline int ExecuteSlackServerUntil(struct timespec endTime) {
  struct timespec now,
      actualEndTime = timespec_sub(
          endTime, (struct timespec){.tv_sec = 0, .tv_nsec = 60000});
  jamCall(Maintenant(&now), 1);
  while (timespec_gt(actualEndTime, now)) {
    SchedulePreemptAt(endTime);
    ExecuteSlackServer();
    CancelPreempt();
    jamCall(Maintenant(&now), 1);
  }
  return 0;
}

static inline int ExecuteRTUntil(uint64_t rtIdx, struct timespec endTime) {
  struct timespec now, st, ed;
  jamCall(Maintenant(&now), 1);
  SchedulePreemptAt(endTime);
  TaskCommonHeader *rtTask = NULL;
  jamCall(
      PlatformMutexLock(&(threadRTSYExecutor.rtsySlots[rtIdx].mtxRTSYEntry)),
      1);
  if (list_size(&(threadRTSYExecutor.rtsySlots[rtIdx].rtsyQueue))) {
    rtTask = list_front(&(threadRTSYExecutor.rtsySlots[rtIdx].rtsyQueue));
    list_remove_front(&(threadRTSYExecutor.rtsySlots[rtIdx].rtsyQueue));
  }
  jamCall(
      PlatformMutexUnlock(&(threadRTSYExecutor.rtsySlots[rtIdx].mtxRTSYEntry)),
      1);
  jamCall(Maintenant(&(threadRTSYExecutor.jitterMeasureTime)), 1);
  if (rtTask) {
    jamCall(ContextSwitchToTask(rtTask), 1);
  }
  return ExecuteSlackServerUntil(endTime);
}

static inline int ExecuteSyncForControllerUntil(
    RTSYControllerRepresentation *controller, struct timespec endTime) {
  struct timespec now, st, ed,
      actualEndTime = timespec_sub(
          endTime, timespec_normalise((struct timespec){
                       .tv_sec = 0,
                       .tv_nsec = 60000 + threadRTSYExecutor.rtsySchedule
                                              .slots[controller->slotClaimed]
                                              .duration}));
  jamCall(Maintenant(&now), 1);
  SchedulePreemptAt(endTime);
  TaskCommonHeader *syncTask =
      __atomic_exchange_n(&controller->syncTask, NULL, __ATOMIC_ACQ_REL);
  if (syncTask) {
    jamCall(Maintenant(&st), 1);
    jamCall(ContextSwitchToTask(syncTask), 1);
    jamCall(Maintenant(&ed), 1);
    threadRTSYExecutor.syncVclk +=
        ConvertTimeSpecToNanoseconds(timespec_sub(ed, st));
  }
  if (threadRTSYExecutor.rtsySchedule.slots[controller->slotClaimed].type ==
          SCHED_RT &&
      timespec_gt(actualEndTime, now)) {
    return ExecuteRTUntil(
        threadRTSYExecutor.rtsySchedule.slots[controller->slotClaimed].id,
        endTime);
  }
  return ExecuteSlackServerUntil(endTime);
}

typedef struct ____AddRTSYExecutorArgType {
  SchedulerManager *schedulerManager;
  PlatformSemaphore *semBegin;
  void (*initEnv)(void *);
  void *initArg;
} __AddRTSYExecutorArgType;

static inline void InitRTTaskTable(RTSYTableEntry *rtsyTable) {
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    CreatePlatformMutex(&(rtsyTable[i].mtxRTSYEntry));
    list_init(&(rtsyTable[i].rtsyQueue));
  }
}

static inline void InitControllerPool(
    RTSYControllerRepresentation *controllerList) {
  for (int i = 0; i < JAMC_MAX_CONTROLLER_CONN; i++) {
    __atomic_store_n(&(controllerList[i].used), 0, __ATOMIC_RELEASE);
  }
}

static inline int YieldRTSY() {
  TaskCommonHeader *task;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCall(GetActiveTask(&task), 1);
  if (task->isBatchTask) {
    BaseTaskExecutor *baseTaskExecutor = task->executor;
    jamCall(PlatformMutexLock(&(baseTaskExecutor->mtxReadyQueue)), 1);
    list_insert_back(&(baseTaskExecutor->readyQueue), (ListNode *)task);
    jamCall(PlatformMutexUnlock(&(baseTaskExecutor->mtxReadyQueue)), 1);
  } else if (task->isInteractiveTask) {
    RTSYExecutor *rtsyTaskExecutor = task->executor;
    jamCall(PlatformMutexLock(&(rtsyTaskExecutor->mtxInteractivePrQueue)), 1);
    pqueue_insert(&(rtsyTaskExecutor->interactivePrQueue), task);
    jamCall(PlatformMutexUnlock(&(rtsyTaskExecutor->mtxInteractivePrQueue)), 1);
  } else {
    JAMC_DISABLE_PREEMPTION_END;
    return 1;
  }
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static void PreemptionHandlerExecuteNextTask(int signum) { YieldRTSY(); }

static int CompareInteractiveTask(const void *iTask1, const void *iTask2) {
  return timespec_lt(((InteractiveTask *)iTask1)->deadline,
                     ((InteractiveTask *)iTask2)->deadline) -
         timespec_gt(((InteractiveTask *)iTask1)->deadline,
                     ((InteractiveTask *)iTask2)->deadline);
}

static inline int CheckBidRequestFinished() {
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    int isFinishedLocal = __atomic_load_n(
        &(threadRTSYExecutor.controllerPool[i].isBIDRequestionFinished),
        __ATOMIC_ACQUIRE);
    if (!isFinishedLocal) {
      return 0;
    }
  }
  return 1;
}

static void TaskSendBidRequest(void) {
  BeginTask();
  RTSYControllerRepresentation *ctlr;
  cbor_item_t *args = cbor_new_definite_map(6), *res = NULL;
  TaskCommonHeader *ctask;
  GetActiveTask(&ctask);
  GetTaskData(&ctlr, ctask);
  ctlr->reward = -1;
  ctlr->slotClaimed = -1;
  ctlr->decision = 0;
  // TODO: Serialize bid request cbor content to controller ctlr
  CallControllerFunction("GetBIDRequest", cbor_move(args), ctlr->ipAddr,
                         ctlr->port, ctlr->uuid, &res, NULL, NULL, NULL, NULL);
  if (res) {
    size_t sz = cbor_map_size(res);
    struct cbor_pair *mitems = cbor_map_handle(res);
    for (size_t i = 0; i < sz; i++) {
      if (!strncmp("reward", cbor_string_handle(mitems[i].key),
                   cbor_string_length(mitems[i].key))) {
        ctlr->reward = cbor_float_get_float(mitems[i].value);
        continue;
      }
      if (!strncmp("slot", cbor_string_handle(mitems[i].key),
                   cbor_string_length(mitems[i].key))) {
        ctlr->slotClaimed = cbor_get_int(mitems[i].value);
        continue;
      }
    }
  }
  cbor_decref(&res);
  __atomic_store_n(&(ctlr->isBIDRequestionFinished), 1, __ATOMIC_RELEASE);
  FinishTask();
}

static inline int SendBidRequests() {
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    if (threadRTSYExecutor.controllerPool[i].used) {
      BatchTask *batchRPCaller = NULL;
      AllocateBatchTask(&batchRPCaller, 4096 * 2);
      if (batchRPCaller) {
        __atomic_store_n(
            &(threadRTSYExecutor.controllerPool[i].isBIDRequestionFinished), 0,
            __ATOMIC_RELEASE);
        CreateBatchTask(batchRPCaller, CreateContext, 4096 * 2,
                        TaskSendBidRequest);
        SetTaskData(batchRPCaller, &(threadRTSYExecutor.controllerPool[i]));
        batchRPCaller->header.Defer = FreeBatchTask;
        batchRPCaller->header.deferArgs = batchRPCaller;
        EnableTaskOnExecutorWithMinimumNumberOfTask(
            batchRPCaller,
            threadRTSYExecutor.baseTaskExecutor.schedulerManager);
      }
    }
  }
  return 0;
}

static inline int HasValidSchedule(RTSYExecutor *executor) {
  jamCall(PlatformMutexLock(&(executor->mtxSchedule)), 1);
  if (executor->rtsySchedule.execLength + executor->rtsySchedule.probeLength >
      0) {
    jamCall(PlatformMutexUnlock(&(executor->mtxSchedule)), 1);
    return 1;
  }
  jamCall(PlatformMutexUnlock(&(executor->mtxSchedule)), 1);
  return 0;
}

static inline int IsValidSchedule(RTSYSchedule *sched) {
  return (sched->execLength + sched->probeLength) > 0;
}

static inline void CheckNewSchedule() {
  jamCall(PlatformMutexLock(&(threadRTSYExecutor.mtxSchedule)), 1);
  if (IsValidSchedule(&(threadRTSYExecutor.newSchedule))) {
    threadRTSYExecutor.rtsySchedule = threadRTSYExecutor.newSchedule;
    memset(&(threadRTSYExecutor.newSchedule), 0, sizeof(RTSYSchedule));
  }
  jamCall(PlatformMutexUnlock(&(threadRTSYExecutor.mtxSchedule)), 1);
  return;
}
#define MAX(_a, _b) ((_a) > (_b)) ? (_a) : (_b)
static inline void DecideBIDRequest() {
  for (int i = 0; i < threadRTSYExecutor.rtsySchedule.execLength; i++) {
    threadRTSYExecutor.claimCounts[i][0] = 0;
    threadRTSYExecutor.claimCounts[i][1] = 0;
    if (threadRTSYExecutor.rtsySchedule.slots[i].type == SCHED_RT) {
      threadRTSYExecutor.claimCounts[i][0]++;
      threadRTSYExecutor.actualMaximizedReward[i] =
          threadRTSYExecutor.rtsySchedule.slots[i].rewardThreshold;
    } else {
      threadRTSYExecutor.actualMaximizedReward[i] = 0.0;
    }
  }
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    if (threadRTSYExecutor.controllerPool[i].used &&
        (threadRTSYExecutor.controllerPool[i].slotClaimed >= 0)) {
      double thisReward = threadRTSYExecutor.controllerPool[i].reward;
      int claimedSlot = threadRTSYExecutor.controllerPool[i].slotClaimed;
      threadRTSYExecutor.claimCounts[claimedSlot][1]++;
      if (thisReward > threadRTSYExecutor.actualMaximizedReward[claimedSlot]) {
        int prevDecision = threadRTSYExecutor.decisions[claimedSlot];
        threadRTSYExecutor.actualMaximizedReward[claimedSlot] = thisReward;
        threadRTSYExecutor.decisions[claimedSlot] = i;
        threadRTSYExecutor.controllerPool[i].decision = 1;
        if (prevDecision >= 0) {
          threadRTSYExecutor.controllerPool[prevDecision].decision = 0;
        }
      }
    }
  }
  for (int i = 0; i < threadRTSYExecutor.rtsySchedule.execLength; i++) {
    if (threadRTSYExecutor.rtsySchedule.slots[i].type == SCHED_BI) {
      if (threadRTSYExecutor.syncVclk >
          MAX(threadRTSYExecutor.batchVclk,
              threadRTSYExecutor.interactiveVclk)) {
        int prevDecision = threadRTSYExecutor.decisions[i];
        threadRTSYExecutor.actualMaximizedReward[i] = 0.0;
        threadRTSYExecutor.decisions[i] = -1;
        if (prevDecision >= 0) {
          threadRTSYExecutor.controllerPool[prevDecision].decision = 0;
        }
      }
    }
  }
}

static void SendBIDDecision(void) {
  BeginTask();
  RTSYControllerRepresentation *ctlr;
  cbor_item_t *args = cbor_new_definite_map(6), *res = NULL;
  TaskCommonHeader *ctask;
  GetActiveTask(&ctask);
  GetTaskData(&ctlr, ctask);
  if (ctlr->decision >= 0) {
    cbor_map_add(args,
                 (struct cbor_pair){
                     .key = cbor_move(cbor_build_string("decision")),
                     .value = cbor_move(cbor_build_uint32(ctlr->decision))});
  } else {
    cbor_map_add(args, (struct cbor_pair){
                           .key = cbor_move(cbor_build_string("decision")),
                           .value = cbor_move(cbor_build_string("rejected"))});
  }
  CallControllerFunction("ReplyBIDDecision", cbor_move(args), ctlr->ipAddr,
                         ctlr->port, ctlr->uuid, &res, NULL, NULL, NULL, NULL);
  cbor_decref(&res);
  __atomic_store_n(&(ctlr->isBIDRequestionFinished), 1, __ATOMIC_RELEASE);
  FinishTask();
}

static inline void SendBIDDecisions() {
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    if (threadRTSYExecutor.controllerPool[i].used &&
        (threadRTSYExecutor.controllerPool[i].slotClaimed >= 0)) {
      BatchTask *batchRPCaller = NULL;
      AllocateBatchTask(&batchRPCaller, 4096 * 2);
      if (batchRPCaller) {
        CreateBatchTask(batchRPCaller, CreateContext, 4096 * 2,
                        SendBIDDecision);
        SetTaskData(batchRPCaller, &(threadRTSYExecutor.controllerPool[i]));
        batchRPCaller->header.Defer = FreeBatchTask;
        batchRPCaller->header.deferArgs = batchRPCaller;
        EnableTaskOnExecutorWithMinimumNumberOfTask(
            batchRPCaller,
            threadRTSYExecutor.baseTaskExecutor.schedulerManager);
      }
    }
  }
}

static inline void SpinUntil(struct timespec tc) {
  struct timespec now;
  do {
    Maintenant(&now);
  } while (timespec_gt(tc, now));
}

#define RT_CORR_FACTOR 1

static void CancelRTSY(TaskCommonHeader *task) {
  if (task) {
    task->isTaskFinished = 1;
    ContextSemaphoreSignalAll(&(task->joinQueue));
    if (task->Defer) {
      task->Defer(task->deferArgs);
    }
  }
}

static RTSYControllerRepresentation * FindControllerRep(const char * uuid) {
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    if (!strcmp(uuid, threadRTSYExecutor.controllerPool[i].uuid)) {
      return &threadRTSYExecutor.controllerPool[i];
    }
  }
  return NULL;
}

static RTSYControllerRepresentation * FindEmpty() {
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    if (!threadRTSYExecutor.controllerPool[i].used) {
      return &threadRTSYExecutor.controllerPool[i];
    }
  }
  return NULL;
}

static void DisconnectPendings() {
  jamCall(PlatformMutexLock(&(threadRTSYExecutor.mtxDeleteBuf)), 1);
  for (int i = 0; i < threadRTSYExecutor.removalPoolWatermark; i++) {
    RTSYControllerRepresentation *ctlr2del = FindControllerRep(threadRTSYExecutor.removalPool[i]);
    ctlr2del->decision = -1;
    ctlr2del->isBIDRequestionFinished = 0;
    ctlr2del->port = 0;
    ctlr2del->reward = 0.0;
    ctlr2del->slotClaimed = -1;
    ctlr2del->syncTask = NULL;
    ctlr2del->used = 0;
    memset(ctlr2del->ipAddr, 0, 16);
    memset(ctlr2del->uuid, 0, 33);
  }
  threadRTSYExecutor.removalPoolWatermark = 0;
  jamCall(PlatformMutexUnlock(&(threadRTSYExecutor.mtxDeleteBuf)), 1);
}

static void ConnectPendings() {
  jamCall(PlatformMutexLock(&(threadRTSYExecutor.mtxConnBuf)), 1);
  for (int i = 0; i < threadRTSYExecutor.connPoolWatermark; i++) {
    if (!FindControllerRep(threadRTSYExecutor.connPool[i].uuid)) {
      RTSYControllerRepresentation *ctlr = FindEmpty();
      ctlr->decision = -1;
      ctlr->isBIDRequestionFinished = 0;
      ctlr->port = threadRTSYExecutor.connPool[i].port;
      ctlr->reward = 0.0;
      ctlr->slotClaimed = -1;
      ctlr->syncTask = NULL;
      ctlr->used = 1;
      strcpy(ctlr->ipAddr, threadRTSYExecutor.connPool[i].ipAddr);
      strcpy(ctlr->uuid, threadRTSYExecutor.connPool[i].uuid);
    }
  }
  threadRTSYExecutor.connPoolWatermark = 0;
  threadRTSYExecutor.connNewCap = 0;
  for (int i = 0; i < MAX_SLOT_LEN; i++) {
    if (!threadRTSYExecutor.controllerPool[i].used) {
      threadRTSYExecutor.connNewCap++;
    }
  }
  jamCall(PlatformMutexUnlock(&(threadRTSYExecutor.mtxConnBuf)), 1);
}

static inline int RefreshConnBuff() {
  DisconnectPendings();
  ConnectPendings();
}

static inline int RefreshTimer(BaseTaskExecutor *bExec) {
  struct timespec tc;
  jamCall(Maintenant(&tc), 1);
  timeouts_update(&(bExec->executorTimer), ConvertTimeSpecToNanoseconds(tc));
  return 0;
}

static void *InstallRTSYExecutor(void *vArgs) {
  __AddRTSYExecutorArgType *args = vArgs;
  PlatformSemaphore *semBegin = args->semBegin;
  SchedulerManager *schedulerManager = args->schedulerManager;
  threadRTSYExecutor.baseTaskExecutor.threadId = PlatformGetCurrentThread();
  threadRTSYExecutor.baseTaskExecutor.NextTask = NextTaskRTSYExecutorImpl;
  threadRTSYExecutor.baseTaskExecutor.EnableTask = EnableTaskRTSYExecutorImpl;
  threadRTSYExecutor.baseTaskExecutor.CleanupPreviousTask =
      CleanupPreviousTaskBaseExecutorImpl;
  threadRTSYExecutor.baseTaskExecutor.executorHook.prev = NULL;
  threadRTSYExecutor.baseTaskExecutor.executorHook.next = NULL;
  threadRTSYExecutor.baseTaskExecutor.schedulerManager = schedulerManager;
  InitBaseExecutorEnv();
  CopyStackInitByDefault();
  EnablePreemptionWith(PreemptionHandlerExecuteNextTask);
  CreatePlatformMutex(&(threadRTSYExecutor.baseTaskExecutor.mtxReadyQueue));
  CreatePlatformMutex(&(threadRTSYExecutor.baseTaskExecutor.mtxTimer));
  CreatePlatformConditionVariable(
      &(threadRTSYExecutor.baseTaskExecutor.cvReadyQueue));
  CreatePlatformSemaphore(&(threadRTSYExecutor.baseTaskExecutor.startSem), 0);
  CreatePlatformSemaphore(&(threadRTSYExecutor.baseTaskExecutor.endSem), 0);
  list_init(&(threadRTSYExecutor.baseTaskExecutor.readyQueue));
  schedulerManager->rtsyExecutor = &(threadRTSYExecutor);
  CreatePlatformMutex(&(threadRTSYExecutor.mtxInteractivePrQueue));
  CreatePlatformMutex(&(threadRTSYExecutor.mtxSchedule));
  CreatePlatformMutex(&(threadRTSYExecutor.mtxControllerPool));
  CreatePlatformMutex(&(threadRTSYExecutor.mtxConnBuf));
  CreatePlatformMutex(&(threadRTSYExecutor.mtxDeleteBuf));
  pqueue_init(&(threadRTSYExecutor.interactivePrQueue), CompareInteractiveTask,
              NULL);
  InitRTTaskTable(&(threadRTSYExecutor.rtsySlots[0]));
  InitControllerPool(&(threadRTSYExecutor.controllerPool[0]));
  threadRTSYExecutor.batchVclk = 0;
  threadRTSYExecutor.interactiveVclk = 0;
  threadRTSYExecutor.syncVclk = 0;
  threadRTSYExecutor.preemptAt = 0;
  threadRTSYExecutor.currSlotIdx = 0;
  threadRTSYExecutor.removalPoolWatermark = 0;
  threadRTSYExecutor.connPoolWatermark = 0;
  threadRTSYExecutor.connNewCap = MAX_SLOT_LEN;
  timeouts_init(&(threadRTSYExecutor.baseTaskExecutor.executorTimer), 0);
  RefreshTimer(&(threadRTSYExecutor.baseTaskExecutor));
  if (args->initEnv) args->initEnv(args->initArg);
  PlatformSemaphoreSignal(semBegin);
  PlatformSemaphoreWait(&(threadRTSYExecutor.baseTaskExecutor.startSem));
  // finish yield
  // finish actual loop
  // launch a batch task to send all bid requests
  while (__atomic_load_n(
      &(threadRTSYExecutor.baseTaskExecutor.schedulerManager->isRunning),
      __ATOMIC_ACQUIRE)) {
    // wait until schedule available
    for (int i = 0; i < MAX_SLOT_LEN; i++) {
      threadRTSYExecutor.decisions[i] = -1;
    }
    RefreshConnBuff();
    CheckNewSchedule();
    while (!IsValidSchedule(&(threadRTSYExecutor.rtsySchedule))) {
      ExecuteSlackServer();
      RefreshConnBuff();
      CheckNewSchedule();
    }
    SendBidRequests();
    while (!CheckBidRequestFinished()) {
      ExecuteSlackServer();
    }
    DecideBIDRequest();
    SendBIDDecisions();
    struct timespec acc = {0, 0};
    Maintenant(&acc);
    for (int i = 0; i < threadRTSYExecutor.rtsySchedule.execLength; i++) {
      struct timespec currSlotDur = timespec_normalise((struct timespec){
          .tv_sec = 0,
          .tv_nsec = threadRTSYExecutor.rtsySchedule.slots[i].duration});
      struct timespec currSlotStart = acc;
      acc = timespec_add(acc, currSlotDur);
      threadRTSYExecutor.jitterMeasureTime =
          (struct timespec){.tv_nsec = 0, .tv_sec = 0};
      switch (threadRTSYExecutor.rtsySchedule.slots[i].type) {
        case SCHED_RT:
          if (threadRTSYExecutor.decisions[i] == -1) {
            ExecuteRTUntil(threadRTSYExecutor.rtsySchedule.slots[i].id, acc);
            break;
          }
        case SCHED_SY:
          if (threadRTSYExecutor.decisions[i] != -1) {
            ExecuteSyncForControllerUntil(
                &(threadRTSYExecutor
                      .controllerPool[threadRTSYExecutor.decisions[i]]),
                acc);
            break;
          }
        case SCHED_BI:
          ExecuteSlackServerUntil(acc);
          break;
        default:
          break;
      }
      if (threadRTSYExecutor.rtsySchedule.slots[i].type == SCHED_RT) {
        double rtRewThrCorr = 0.0;
        threadRTSYExecutor.jitterMeasureTime = timespec_sub(
                  threadRTSYExecutor.jitterMeasureTime, currSlotStart);
        if (timespec_gt(threadRTSYExecutor.jitterMeasureTime,
                        (struct timespec){0, 0})) {
          rtRewThrCorr =
              ((double)(ConvertTimeSpecToNanoseconds(threadRTSYExecutor.jitterMeasureTime))) /
              threadRTSYExecutor.rtsySchedule.slots[i].duration;
        }
        rtRewThrCorr += 1.0;
        size_t numRTPending = list_size(
            &(threadRTSYExecutor
                  .rtsySlots[threadRTSYExecutor.rtsySchedule.slots[i].id]
                  .rtsyQueue));
        // (#RTPending/(#SyncClaimed + #RTPending)) * (1 + jitter/slotDur)
        threadRTSYExecutor.rtsySchedule.slots[i].rewardThreshold *=
            (((double)(numRTPending)) /
             (numRTPending + threadRTSYExecutor.claimCounts[i][1])) *
            RT_CORR_FACTOR * rtRewThrCorr;
      }
      SpinUntil(acc);
    }
    for (int i = 0; i < MAX_SLOT_LEN; i++) {
      if (threadRTSYExecutor.controllerPool[i].used) {
        CancelRTSY(__atomic_exchange_n(&(threadRTSYExecutor.controllerPool[i].syncTask), NULL, __ATOMIC_ACQ_REL));
      }
    }
  }
  return NULL;
}

int AddRTSYExecutor(void *lpSchedManager, void (*initEnv)(void *),
                    void *initArg) {
  PlatformSemaphore semBegin;
  PlatformThread tid;
  __AddRTSYExecutorArgType args;
  args.schedulerManager = lpSchedManager;
  args.semBegin = &semBegin;
  args.initEnv = initEnv;
  args.initArg = initArg;
  jamCall(CreatePlatformSemaphore(&semBegin, 0), 1);
  jamCall(CreatePlatformThread(&tid, InstallRTSYExecutor, &args), 1);
  jamCall(PlatformSemaphoreWait(&semBegin), 1);
  jamCall(DestroyPlatformSemaphore(&semBegin), 1);
}

int CreateRTTask(void *lpTask, unsigned long stackSize, void (*fn)(void),
                 uint16_t slot) {
  RealTimeTask *realTimeTask = lpTask;
  jamCall(CreateContext(&(realTimeTask->ctx), stackSize, fn), 1);
  realTimeTask->header.elemHook = (struct ListNode)LIST_NODE_INIT;
  realTimeTask->header.isBatchTask = 0;
  realTimeTask->header.isInteractiveTask = 0;
  realTimeTask->header.isRealTimeTask = 1;
  realTimeTask->header.isSyncBarrierTask = 0;
  realTimeTask->header.isTaskFinished = 0;
  realTimeTask->header.executor = &threadRTSYExecutor;
  realTimeTask->header.Defer = NULL;
  realTimeTask->header.deferArgs = NULL;
  realTimeTask->slotId = slot;
  __atomic_store_n(&(realTimeTask->header.isMovableTask), 0, __ATOMIC_RELEASE);
  __atomic_store_n(&(realTimeTask->header.cvWaiting), NULL, __ATOMIC_RELEASE);
  return CreateContextSemaphore(&(realTimeTask->header.joinQueue), 0);
}

int CreateSYTask(void *lpTask, unsigned long stackSize, void (*fn)(void),
                 const char *controllerId) {
  SyncBarrierTask *syncBarrierTask = lpTask;
  jamCall(CreateContext(&(syncBarrierTask->ctx), stackSize, fn), 1);
  syncBarrierTask->header.elemHook = (struct ListNode)LIST_NODE_INIT;
  syncBarrierTask->header.isBatchTask = 0;
  syncBarrierTask->header.isInteractiveTask = 0;
  syncBarrierTask->header.isRealTimeTask = 0;
  syncBarrierTask->header.isSyncBarrierTask = 1;
  syncBarrierTask->header.isTaskFinished = 0;
  syncBarrierTask->header.executor = &threadRTSYExecutor;
  syncBarrierTask->header.Defer = NULL;
  syncBarrierTask->header.deferArgs = NULL;
  strcpy(syncBarrierTask->controllerUuid, controllerId);
  __atomic_store_n(&(syncBarrierTask->header.isMovableTask), 0,
                   __ATOMIC_RELEASE);
  __atomic_store_n(&(syncBarrierTask->header.cvWaiting), NULL,
                   __ATOMIC_RELEASE);
  return CreateContextSemaphore(&(syncBarrierTask->header.joinQueue), 0);
}

int CreateInteractiveTask(void *lpTask, unsigned long stackSize,
                          void (*fn)(void), struct timespec deadline) {
  InteractiveTask *interactiveTask = lpTask;
  jamCall(CreateContext(&(interactiveTask->ctx), stackSize, fn), 1);
  interactiveTask->header.elemHook = (struct ListNode)LIST_NODE_INIT;
  interactiveTask->header.isBatchTask = 0;
  interactiveTask->header.isInteractiveTask = 1;
  interactiveTask->header.isRealTimeTask = 0;
  interactiveTask->header.isSyncBarrierTask = 0;
  interactiveTask->header.isTaskFinished = 0;
  interactiveTask->header.executor = &threadRTSYExecutor;
  interactiveTask->header.Defer = NULL;
  interactiveTask->header.deferArgs = NULL;
  interactiveTask->deadline = deadline;
  __atomic_store_n(&(interactiveTask->header.isMovableTask), 0,
                   __ATOMIC_RELEASE);
  __atomic_store_n(&(interactiveTask->header.cvWaiting), NULL,
                   __ATOMIC_RELEASE);
  return CreateContextSemaphore(&(interactiveTask->header.joinQueue), 0);
}

int DeleteController(void *rtep, const char *uuid) {
  RTSYExecutor *rte = rtep;
  int ret = 1;
  jamCall(PlatformMutexLock(&(rte->mtxDeleteBuf)), 1);
  if (rte->removalPoolWatermark < MAX_SLOT_LEN) {
    strcpy(rte->removalPool[rte->removalPoolWatermark++], uuid);
    ret = 0;
  }
  jamCall(PlatformMutexUnlock(&(rte->mtxDeleteBuf)), 1);
  return ret;
}

static int OccupyEmptyController(void *rtep, const char *ipAddr, int port, const char *uuid) {
  RTSYExecutor *rte = rtep;
  int ret = 1;
  jamCall(PlatformMutexLock(&(rte->mtxConnBuf)), 1);
  if (rte->connNewCap > 0) {
    rte->connNewCap--;
    rte->connPool[rte->connPoolWatermark++].port = port;
    strcpy(rte->connPool[rte->connPoolWatermark++].uuid, uuid);
    strcpy(rte->connPool[rte->connPoolWatermark++].ipAddr, ipAddr);
    ret = 0;
  }
  jamCall(PlatformMutexUnlock(&(rte->mtxConnBuf)), 1);
  return ret;
}

int ConnectPrimaryController(void *rtep, const char *ipAddr, int port, const char *uuid) {
  MQTTTaskLaunchSubscriber *poolerTask = NULL;
  if (OccupyEmptyController(rtep, ipAddr, port, uuid)) {
    return 1;
  }
  jamCall(CreateMQTTTaskLaunchSubscriptionTask2(&poolerTask, ipAddr, port, uuid), 1);
  poolerTask->subscribeSchedule = 1;
  return EnableTaskOnExecutorWithMinimumNumberOfTask(poolerTask, threadRTSYExecutor.baseTaskExecutor.schedulerManager);
}

int ConnectToController(void *rtep, const char *ipAddr, int port, const char *uuid) {
  MQTTTaskLaunchSubscriber *poolerTask = NULL;
  if (OccupyEmptyController(rtep, ipAddr, port, uuid)) {
    return 1;
  }
  jamCall(CreateMQTTTaskLaunchSubscriptionTask2(&poolerTask, ipAddr, port, uuid), 1);
  return EnableTaskOnExecutorWithMinimumNumberOfTask(poolerTask, threadRTSYExecutor.baseTaskExecutor.schedulerManager);
}

int ChangeSchedule(void *rtep, cbor_item_t *unparsed) {
  RTSYExecutor *rte = rtep;
  int ret = 1;
  jamCall(PlatformMutexLock(&(rte->mtxSchedule)), 1);
  // TODO: parse info into, do not cbor_decref unparsed
  threadRTSYExecutor.newSchedule;
  jamCall(PlatformMutexUnlock(&(rte->mtxSchedule)), 1);
  return ret;
}
