#include "baseexecutor.h"

#include <assert.h>
#include <stdlib.h>
#include <time.h>

#include "funcreg.h"
#include "rtsyched.h"

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

typedef struct ____AddExecutorArgType {
  SchedulerManager *schedulerManager;
  sem_t *semBegin;
  void (*initEnv)(void *);
  void *initArg;
} __AddExecutorArgType;

typedef struct ____ArgumentTimer {
  ListNode timerHook;
  struct timespec deltaSleep;
  size_t startIdx, len;
  PlatformSemaphore semStart, semEnd;
  PlatformThread timerThreadId;
  SchedulerManager *schedulerManager;
} __ArgumentTimer;

static __thread DeclBatchTask(mainContext, 256 * 4096);
static __thread DeclContext(kInlineContextStack, 128 * 4096);
static __thread BaseTaskExecutor threadTaskExecutor;
static __thread TaskCommonHeader *threadPrevTask, *threadNextTask;
static __thread __ArgumentTimer argTimer;

/**
 * Initialize batch task info. fields and init wait semaphore
 */
static inline int InitBatch(BatchTask *batchTask) {
  batchTask->header.elemHook = (struct ListNode)LIST_NODE_INIT;
  batchTask->header.isBatchTask = 1;
  batchTask->header.isInteractiveTask = 0;
  batchTask->header.isRealTimeTask = 0;
  batchTask->header.isSyncBarrierTask = 0;
  batchTask->header.isTaskFinished = 0;
  batchTask->header.isTaskStealable = 1;
  batchTask->header.executor = &threadTaskExecutor;
  batchTask->header.Defer = NULL;
  batchTask->header.deferArgs = NULL;
  __atomic_store_n(&(batchTask->header.isMovableTask), 1, __ATOMIC_RELEASE);
  __atomic_store_n(&(batchTask->header.cvWaiting), NULL, __ATOMIC_RELEASE);
  return CreateContextSemaphore(&(batchTask->header.joinQueue), 0);
}

/**
 * As name suggested, used for adding a task from global context
 * considering load balancing
 */
static inline int GetExecutorWithMinTaskCount(
    BaseTaskExecutor **minExecutor, SchedulerManager *schedulerManager) {
  *minExecutor =
      (BaseTaskExecutor *)list_front(&(schedulerManager->schedulers));
  assert(*minExecutor);
  ListNode *ptrCurrentNode;
  unsigned long int minSize = __UINT64_MAX__;
  list_for_each(ptrCurrentNode, &(schedulerManager->schedulers)) {
    unsigned long currentSize =
        list_size(&(((BaseTaskExecutor *)ptrCurrentNode)->readyQueue));
    if (currentSize == 0) {
      *minExecutor = (BaseTaskExecutor *)ptrCurrentNode;
      return 0;
    }
    if (minSize > currentSize) {
      *minExecutor = (BaseTaskExecutor *)ptrCurrentNode;
      minSize = currentSize;
    }
  }

  return 0;
}

/**
 * Iterate the list of executors of scheduler manager as circular list
 */
static inline int GetNextExecutorCircular(SchedulerManager *schedulerManager,
                                          BaseTaskExecutor **taskCommonHeader) {
  if (likely(taskCommonHeader)) {
    if (((BaseTaskExecutor *)list_back(&(schedulerManager->schedulers))) ==
        *taskCommonHeader) {
      *taskCommonHeader =
          (BaseTaskExecutor *)list_front(&(schedulerManager->schedulers));
      return 0;
    }
    *taskCommonHeader =
        (BaseTaskExecutor *)list_next((ListNode *)(*taskCommonHeader));
    return 0;
  }
  return 1;
}

static inline int IsTaskMovable(int *isMovable, TaskCommonHeader *task) {
  *isMovable = __atomic_load_n(&(task->isMovableTask), __ATOMIC_ACQUIRE);
  return 0;
}

/**
 * Add a task with TaskCommonHeader to queue of base executor
 * No need to acquire lock from outside
 * Lock acquired inside
 * Preemption signal disabled
 */
static inline int AddTaskToExecutor(BaseTaskExecutor *baseTaskExecutor,
                                    TaskCommonHeader *task) {
  int isTaskStealable;
  IsTaskMovable(&isTaskStealable, task);
  jamCall(PlatformMutexLock(&(baseTaskExecutor->mtxReadyQueue)), 1);
  if (isTaskStealable) {
    baseTaskExecutor->stealableCount = baseTaskExecutor->stealableCount + 1;
  }
  list_insert_front(&(baseTaskExecutor->readyQueue), (ListNode *)task);
  if (list_size(&(baseTaskExecutor->readyQueue)) == 1) {
    jamCall(PlatformConditionVariableSignal(&(baseTaskExecutor->cvReadyQueue)),
            1);
  }
  jamCall(PlatformMutexUnlock(&(baseTaskExecutor->mtxReadyQueue)), 1);
  return 0;
}

static inline int IsTaskCopyStack(int *isMovable, TaskCommonHeader *task) {
  if (((TaskCommonHeader *)task)->isBatchTask) {
    *isMovable = ((BatchTask *)task)->ctx.isCopyStackContext;
    return 0;
  }
  if (((TaskCommonHeader *)task)->isInteractiveTask) {
    *isMovable = ((InteractiveTask *)task)->ctx.isCopyStackContext;
    return 0;
  }
  if (((TaskCommonHeader *)task)->isRealTimeTask) {
    *isMovable = ((RealTimeTask *)task)->ctx.isCopyStackContext;
    return 0;
  }
  if (((TaskCommonHeader *)task)->isSyncBarrierTask) {
    *isMovable = ((SyncBarrierTask *)task)->ctx.isCopyStackContext;
    return 0;
  }
  return 1;
}

/**
 * As name suggested
 * Define movable tasks are standalone stack tasks that swapped out and
 * copy stack tasks that has not been executed,
 * Given a baseExecutor, find number of such movable tasks
 */
static inline int GetNumberOfMovableTasks(unsigned long int *pNumOfMovableTasks,
                                          BaseTaskExecutor *baseExecutor) {
  int isMovable;
  if (likely(pNumOfMovableTasks)) {
    ListNode *curr, *backup;
    *pNumOfMovableTasks = baseExecutor->stealableCount;
    /*list_for_each(curr, &(baseExecutor->readyQueue)) {
      jamCall(IsTaskMovable(&isMovable, (TaskCommonHeader *)curr), 1);
      if (isMovable) {
        (*pNumOfMovableTasks)++;
      }
    }*/
    return 0;
  }
  return 1;
}

/**
 * For standalone stack task, change executor pointer
 * For copy stack task, change executor pointer and stack pointer
 */
static inline int MoveTask(TaskCommonHeader *currTask) {
  int isTaskCopyStack, istaskMovable;
  currTask->executor = &threadTaskExecutor;
  jamCall(IsTaskCopyStack(&isTaskCopyStack, currTask), 1);
  if (isTaskCopyStack) {
    jamCall(IsTaskMovable(&istaskMovable, currTask), 1);
    assert(istaskMovable);
    if (((TaskCommonHeader *)currTask)->isBatchTask) {
      return RefreshStackContext(&(((BatchTask *)currTask)->ctx));
    }
    /*if (((TaskCommonHeader *)currTask)->isInteractiveTask) {
      return RefreshStackContext(&(((InteractiveTask *)currTask)->ctx));
    }
    if (((TaskCommonHeader *)currTask)->isRealTimeTask) {
      return RefreshStackContext(&(((RealTimeTask *)currTask)->ctx));
    }
    if (((TaskCommonHeader *)currTask)->isSyncBarrierTask) {
      return RefreshStackContext(&(((SyncBarrierTask *)currTask)->ctx));
    }*/
    return 1;
  }
  return 0;
}

/**
 * Given an executor baseExecutor, move half of movable tasks of baseExecutor to
 * the executor of current thread
 */
static inline int GetListOfMovableTasks(int *hasTaskMoved, ListNode *temp,
                                        BaseTaskExecutor *baseExecutor) {
  int isMovable;
  ListNode *curr, *backup;
  unsigned long int numOfMovableTasks;
  jamCall(GetNumberOfMovableTasks(&numOfMovableTasks, baseExecutor), 1);
  unsigned long int numOfTasksToMove = numOfMovableTasks / 2;
  list_for_each_safe_reverse(curr, backup, &(baseExecutor->readyQueue)) {
    if (!numOfTasksToMove) {
      break;
    }
    jamCall(IsTaskMovable(&isMovable, (TaskCommonHeader *)curr), 1);
    if (isMovable) {
      ListNode *toMove = curr;
      baseExecutor->stealableCount = baseExecutor->stealableCount - 1;
      list_remove(&(baseExecutor->readyQueue), curr);
      jamCall(MoveTask((TaskCommonHeader *)toMove), 1);
      list_insert_front(temp, toMove);
      numOfTasksToMove--;
    }
  }
  *hasTaskMoved = !list_empty(temp);
  return 0;
}

/**
 * Try to steal tasks from other executors of the schedulerManager
 * Number of cycles are defined by STEAL_TRAIL_ROUNDS
 */
static inline int GetTaskFromOtherExecutors(
    int *hasTaskObtained, List *listTemp, SchedulerManager *schedulerManager) {
  *hasTaskObtained = 0;
  unsigned long int numOfExecutors = list_size(&(schedulerManager->schedulers));
  unsigned long int numIters = numOfExecutors * STEAL_TRAIL_ROUNDS;
  BaseTaskExecutor *currExecutor = &(threadTaskExecutor);
  while (numIters--) {
    jamCall(GetNextExecutorCircular(schedulerManager, &currExecutor), 1);
    if (currExecutor != &(threadTaskExecutor) && currExecutor && 
        !PlatformMutexTryLock(&(currExecutor->mtxReadyQueue))) {
      if (0 < currExecutor->stealableCount && currExecutor->stealableCount < 7000) { //  
        // printf("SSSSTTTTEEEEAAAAALLLLLAAABBBBLLLLEE:%llu\n", currExecutor->stealableCount);
        jamCall(GetListOfMovableTasks(hasTaskObtained, listTemp, currExecutor), 1);
      }
      jamCall(PlatformMutexUnlock(&(currExecutor->mtxReadyQueue)), 1);
      if (*hasTaskObtained) {
        return 0;
      }
    }
  }

  return 0;
}
static __thread int execIdx = -1;
int GetExecutorIndex(BaseTaskExecutor *b, SchedulerManager *s) {
  if (execIdx) {
    execIdx = list_index_of(&(s->schedulers), &(b->executorHook));
  }
  return execIdx;
}
// #define DISABLE_WORKSTEAL 1
/**
 * Get next task to execute
 */
static inline int GetNextTaskFromExecutor(TaskCommonHeader **pTask) {
  List listTemp;
  jamCall(PlatformMutexLock(&(threadTaskExecutor.mtxReadyQueue)), 1);
  while (list_empty(&(threadTaskExecutor.readyQueue)) &&
         __atomic_load_n(&(threadTaskExecutor.schedulerManager->isRunning),
                         __ATOMIC_ACQUIRE)) {
    int hasTaskObtained = 0;
#ifndef DISABLE_WORKSTEAL
    jamCall(PlatformMutexUnlock(&(threadTaskExecutor.mtxReadyQueue)), 1);
    list_init(&listTemp);
    jamCall(GetTaskFromOtherExecutors(&hasTaskObtained, &listTemp,
                                      threadTaskExecutor.schedulerManager),
            1);
    jamCall(PlatformMutexLock(&(threadTaskExecutor.mtxReadyQueue)), 1);
#endif
    if (unlikely(!hasTaskObtained)) {
      jamCall(PlatformConditionVariableWaitFor(
                  &(threadTaskExecutor.cvReadyQueue),
                  &(threadTaskExecutor.mtxReadyQueue),
                  (struct timespec){.tv_sec = 0, .tv_nsec = 10 * 1000}),
              1);
    } else {
      threadTaskExecutor.stealableCount += list_size(&listTemp);
      list_splice_back(&(threadTaskExecutor.readyQueue), &listTemp);
      break;
    }
  }
  if (!__atomic_load_n(&(threadTaskExecutor.schedulerManager->isRunning),
                       __ATOMIC_ACQUIRE)) {
    jamCall(PlatformMutexUnlock(&(threadTaskExecutor.mtxReadyQueue)), 1);
    *pTask = NULL;
    return 0;
  }
  *pTask = (TaskCommonHeader *)list_front(&(threadTaskExecutor.readyQueue));
  int isStealable;
  if (IsTaskMovable(&isStealable, *pTask)) {
    threadTaskExecutor.stealableCount = threadTaskExecutor.stealableCount - 1;
  }
  list_remove_front(&(threadTaskExecutor.readyQueue));
  jamCall(PlatformMutexUnlock(&(threadTaskExecutor.mtxReadyQueue)), 1);
  return 0;
}

/**
 * Cleanup includes
 * - set the swapped out task to movable if it's a standalone stack task
 * - notify the tasks waiting for swapped out task if it's ended
 * Insert call to this function at
 * - Start of a task
 * - After NextTask()/swap out/Context Switch
 */
int CleanupPreviousTaskBaseExecutorImpl(void) {
  int isTaskCopyStack;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  if (threadPrevTask != (TaskCommonHeader *)(&mainContext)) {
    jamCallEnablePreemption(IsTaskCopyStack(&isTaskCopyStack, threadPrevTask),
                            1);
    if ((!isTaskCopyStack) && (threadPrevTask != threadNextTask) &&
        (threadPrevTask->isTaskStealable)) {
      __atomic_store_n(&(threadPrevTask->isMovableTask), 1, __ATOMIC_RELEASE);
    }
    if (threadPrevTask->isTaskFinished) {
      jamCallEnablePreemption(
          ContextSemaphoreSignalAll(&(threadPrevTask->joinQueue)), 1);
      if (threadPrevTask->Defer) {
        threadPrevTask->Defer(threadPrevTask->deferArgs);
      }
    }
  }
  threadPrevTask = threadNextTask;
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static int CleanupPreviousTask(void) {
  return threadTaskExecutor.CleanupPreviousTask();
}

static inline int ContextSwitchToTaskImpl(TaskCommonHeader *taskHeader) {
  JAMC_DISABLE_PREEMPTION_BEGIN;
  int ret = 0;
  if (likely(taskHeader)) {
    __atomic_store_n(&(taskHeader->isMovableTask), 0, __ATOMIC_RELEASE);
    threadNextTask = taskHeader;
    if (taskHeader->isBatchTask) {
      jamCallEnablePreemption(
          ContextSwitchTo(&(((BatchTask *)taskHeader)->ctx)), 1);
    } else if (taskHeader->isInteractiveTask) {
      jamCallEnablePreemption(
          ContextSwitchTo(&(((InteractiveTask *)taskHeader)->ctx)), 1);
    } else if (taskHeader->isRealTimeTask) {
      jamCallEnablePreemption(
          ContextSwitchTo(&(((RealTimeTask *)taskHeader)->ctx)), 1);
    } else if (taskHeader->isSyncBarrierTask) {
      jamCallEnablePreemption(
          ContextSwitchTo(&(((SyncBarrierTask *)taskHeader)->ctx)), 1);
    } else {
      return 1;
    }
  } else {
    threadNextTask = (TaskCommonHeader *)mainContext;
    jamCallEnablePreemption(ContextSwitchTo(&(((BatchTask *)mainContext)->ctx)),
                            1);
  }
  jamCallEnablePreemption(CleanupPreviousTask(), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int ContextSwitchToTask(TaskCommonHeader *taskHeader) {
  return ContextSwitchToTaskImpl(taskHeader);
}

/**
 * Add task to end of ready queue of current thread to let it run later on
 */
static inline int EnableLater(TaskCommonHeader *task) {
  int isTaskStealable;
  IsTaskMovable(&isTaskStealable, task);
  jamCall(PlatformMutexLock(&(threadTaskExecutor.mtxReadyQueue)), 1);
  if (IS_LISTNODE_UNLINKED(task->elemHook)) {
    if (isTaskStealable) {
      threadTaskExecutor.stealableCount = threadTaskExecutor.stealableCount + 1;
    }
    list_insert_back(&(threadTaskExecutor.readyQueue), (ListNode *)task);
  }
  if (list_size(&(threadTaskExecutor.readyQueue)) == 1) {
    jamCall(PlatformConditionVariableSignal(&(threadTaskExecutor.cvReadyQueue)),
            1);
  }
  jamCall(PlatformMutexUnlock(&(threadTaskExecutor.mtxReadyQueue)), 1);
  return 0;
}

static inline int YieldInternal(void) {
  TaskCommonHeader *task2yield;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(GetActiveTask(&task2yield), 1);
  jamCallEnablePreemption(EnableLater(task2yield), 1);
  jamCallEnablePreemption(NextTask(), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

/**
 * Update timer to latest timestamp (unix)
 * @warning: lock to executor timer must be acquired before call to this
 * function
 */
static inline int RefreshTimer(BaseTaskExecutor *bExec) {
  struct timespec tc;
  jamCall(Maintenant(&tc), 1);
  timeouts_update(&(bExec->executorTimer), ConvertTimeSpecToNanoseconds(tc));
  return 0;
}

/**
 * When there's a preemption signal, yield the current task
 */
static void PreemptionHandlerExecuteNextTask(int signum) { YieldInternal(); }

//
// Task API
//

int CreateBatchTask(void *lpTask, ContextCreatorType FnCreateTask,
                    unsigned long stackSize, void (*fn)(void)) {
  BatchTask *t = lpTask;
  jamCall(FnCreateTask(&(t->ctx), stackSize, fn), 1);
  jamCall(InitBatch(lpTask), 1);
  return 0;
}

int DestroyBatchTask(void *lpTask) {
  TaskCommonHeader *tch = lpTask;
  jamCall(DestroyContextSemaphore(&(tch->joinQueue)), 1);
  return 0;
}

int BeginTask(void) {
  jamCall(CleanupPreviousTask(), 1);
  jamCall(BeginContext(), 1);
  EnablePreemptionSignal(0);
  return 0;
}

int RelinquishTask(void) {
  YieldInternal();
  return 0;
}

int FinishTask(void) {
  TaskCommonHeader *task;
  DisablePreemptionSignal();
  jamCall(GetActiveTask(&task), 1);
  task->isTaskFinished = 1;
  jamCall(NextTask(), 1);
  printf("current task %p\n", task);
  return 0;
}

static int NextTaskBaseExecutorImpl(void) {
  int hasTaskObtained;
  TaskCommonHeader *task = NULL, *taskActive;
  List listTmp;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(GetActiveTask(&taskActive), 1);
  if (!__atomic_load_n(&(threadTaskExecutor.schedulerManager->isRunning),
                       __ATOMIC_ACQUIRE)) {
    return ContextSwitchToTaskImpl(task);
  }
  jamCallEnablePreemption(
      PlatformMutexLock(&(threadTaskExecutor.mtxReadyQueue)), 1);
#ifndef DISABLE_WORKSTEAL
  if (list_empty(&(threadTaskExecutor.readyQueue))) {
    jamCallEnablePreemption(
      PlatformMutexUnlock(&(threadTaskExecutor.mtxReadyQueue)), 1);
    list_init(&listTmp);
    jamCallEnablePreemption(
        GetTaskFromOtherExecutors(&hasTaskObtained, &listTmp,
                                  threadTaskExecutor.schedulerManager),
        1);
    jamCallEnablePreemption(
      PlatformMutexLock(&(threadTaskExecutor.mtxReadyQueue)), 1);
    if (hasTaskObtained) {
      threadTaskExecutor.stealableCount += list_size(&listTmp);
      list_splice_back(&(threadTaskExecutor.readyQueue), &listTmp);
    }
  }
#endif
  if (likely(!list_empty(&(threadTaskExecutor.readyQueue)))) {
    task = (TaskCommonHeader *)list_front(&(threadTaskExecutor.readyQueue));
    int isCopyStack = 0, isStealable = 0;
    IsTaskCopyStack(&isCopyStack, task);
    if (isCopyStack) {
      task = NULL;
    } else {
      if (IsTaskMovable(&isStealable, task)) {
        threadTaskExecutor.stealableCount = threadTaskExecutor.stealableCount - 1;
      }
      list_remove_front(&(threadTaskExecutor.readyQueue));
    }
  }
  jamCallEnablePreemption(
      PlatformMutexUnlock(&(threadTaskExecutor.mtxReadyQueue)), 1);
  jamCallEnablePreemption(ContextSwitchToTaskImpl(task), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int NextTask(void) {
  TaskCommonHeader *currTask;
  jamCall(GetActiveTask(&currTask), 1);
  return currTask->executor->NextTask();
}

static int EnableTaskBaseExecutorImpl(void *_task) {
  JAMC_DISABLE_PREEMPTION_BEGIN;
  TaskCommonHeader *task = _task;
  jamCallEnablePreemption(
      AddTaskToExecutor(task->executor, (TaskCommonHeader *)task), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int EnableTask(void *_task) {
  return ((TaskCommonHeader *)_task)->executor->EnableTask(_task);
}

int EnableTaskOnCurrentExecutor(void *_task) {
  TaskCommonHeader *task = _task;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  task->executor = &threadTaskExecutor;
  jamCallEnablePreemption(
      AddTaskToExecutor(task->executor, (TaskCommonHeader *)task), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

static inline int StealCopyStack(TaskCommonHeader *task, BaseTaskExecutor *exec) {
  if (((TaskCommonHeader *)task)->isBatchTask) {
    ((BatchTask *)task)->ctx.registers[JAMC_STACK_POINTER_REG] = exec->sharedStackBeginPtr;
  }
  if (((TaskCommonHeader *)task)->isInteractiveTask) {
    ((InteractiveTask *)task)->ctx.registers[JAMC_STACK_POINTER_REG] = exec->sharedStackBeginPtr;
  }
  if (((TaskCommonHeader *)task)->isRealTimeTask) {
    ((RealTimeTask *)task)->ctx.registers[JAMC_STACK_POINTER_REG] = exec->sharedStackBeginPtr;
  }
  if (((TaskCommonHeader *)task)->isSyncBarrierTask) {
    ((SyncBarrierTask *)task)->ctx.registers[JAMC_STACK_POINTER_REG] = exec->sharedStackBeginPtr;
  }
  return 0;
}

int EnableTaskOnExecutorWithMinimumNumberOfTask(void *_task,
                                                void *_schedManager) {
  int isTaskCopyStack;
  TaskCommonHeader *task = _task;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(IsTaskCopyStack(&isTaskCopyStack, task), 1);
  jamCallEnablePreemption(
      GetExecutorWithMinTaskCount(&(task->executor), _schedManager), 1);
  if (isTaskCopyStack) {
    StealCopyStack(task, task->executor);
  }
  jamCallEnablePreemption(
      AddTaskToExecutor(task->executor, (TaskCommonHeader *)task), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int EnableTaskOnIndexedExecutor(void *_task, void *_schedManager, size_t n) {
  int isTaskCopyStack;
  TaskCommonHeader *task = _task;
  SchedulerManager *schedManager = _schedManager;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(IsTaskCopyStack(&isTaskCopyStack, task), 1);
  task->executor = (BaseTaskExecutor *)list_at(&(schedManager->schedulers), n);
  if (isTaskCopyStack) {
    StealCopyStack(task, task->executor);
  }
  jamCallEnablePreemption(
      AddTaskToExecutor(task->executor, (TaskCommonHeader *)task), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int WaitForTaskUntilFinish(void *_lptask) {
  TaskCommonHeader *task = _lptask;
  jamCall(ContextSemaphoreWait(&(task->joinQueue)), 1);
  return 0;
}

int CurrentTaskWaitFor(struct timespec tc) {
  uint64_t tp;
  struct timespec tps;
  TaskCommonHeader *taskActive;
  jamCall(RelativeTimeToAbsoluteTimeTimeSpec(&tps, tc), 1);
  jamCall(GetActiveTask(&taskActive), 1);
  int prevStat = FixTaskToItsCore(taskActive);
  JAMC_DISABLE_PREEMPTION_BEGIN;
  __atomic_store_n(&(taskActive->cvWaiting), NULL, __ATOMIC_RELEASE);
  __atomic_store_n(&(taskActive->cvStatus), 0, __ATOMIC_RELEASE);
  timeout_init(&(taskActive->timeOut), TIMEOUT_ABS);
  jamCallEnablePreemption(
      __ContextSpinMutexInternalLock(&(taskActive->executor->mtxTimer)), 1);
  timeouts_add(&(taskActive->executor->executorTimer), &(taskActive->timeOut),
               ConvertTimeSpecToNanoseconds(tps));
  jamCallEnablePreemption(
      __ContextSpinMutexInternalUnlock(&(taskActive->executor->mtxTimer)), 1);
  jamCallEnablePreemption(NextTask(), 1);
  UnFixTaskToItsCore(taskActive, prevStat);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int SetTaskData(void *ucp, void *dt) {
  TaskCommonHeader *task = ucp;
  if (task->isBatchTask) {
    return SetContextData(&(((BatchTask *)task)->ctx), dt);
  }
  if (task->isInteractiveTask) {
    return SetContextData(&(((InteractiveTask *)task)->ctx), dt);
  }
  if (task->isRealTimeTask) {
    return SetContextData(&(((RealTimeTask *)task)->ctx), dt);
  }
  if (task->isSyncBarrierTask) {
    return SetContextData(&(((SyncBarrierTask *)task)->ctx), dt);
  }
  return 1;
}

int GetTaskData(void *datap, void *ucp) {
  TaskCommonHeader *task = ucp;
  if (task->isBatchTask) {
    return GetContextData(datap, &(((BatchTask *)task)->ctx));
  }
  if (task->isInteractiveTask) {
    return GetContextData(datap, &(((InteractiveTask *)task)->ctx));
  }
  if (task->isRealTimeTask) {
    return GetContextData(datap, &(((RealTimeTask *)task)->ctx));
  }
  if (task->isSyncBarrierTask) {
    return GetContextData(datap, &(((SyncBarrierTask *)task)->ctx));
  }
  return 1;
}

int GetActiveTask(void *utcpp) {
  *((void **)utcpp) = threadPrevTask;
  return 0;
}

int FixTaskToItsCore(void *ucp) {
  TaskCommonHeader *task = ucp;
  int prev = task->isTaskStealable;
  task->isTaskStealable = 0;
  __atomic_store_n(&(task->isMovableTask), 0, __ATOMIC_RELEASE);
  return prev;
}

int UnFixTaskToItsCore(void *ucp, int val) {
  TaskCommonHeader *task = ucp;
  task->isTaskStealable = val;
  return 0;
}

//
// Executor API
//

void InitBaseExecutorEnv() {
  ((BatchTask *)(mainContext))->header.isBatchTask = 1;
  CreateBatchTask(mainContext, CreateContext, 256 * 4096, NULL);
  threadNextTask = (TaskCommonHeader *)mainContext;
  threadPrevTask = (TaskCommonHeader *)mainContext;
  InitWith(&(((BatchTask *)mainContext)->ctx));
}

static void *InstallExecutor(void *vargs) {
  __AddExecutorArgType *args = vargs;
  PlatformSemaphore *semBegin = args->semBegin;
  SchedulerManager *schedulerManager = args->schedulerManager;
  threadTaskExecutor.threadId = PlatformGetCurrentThread();
  threadTaskExecutor.NextTask = NextTaskBaseExecutorImpl;
  threadTaskExecutor.EnableTask = EnableTaskBaseExecutorImpl;
  threadTaskExecutor.CleanupPreviousTask = CleanupPreviousTaskBaseExecutorImpl;
  threadTaskExecutor.executorHook.prev = NULL;
  threadTaskExecutor.executorHook.next = NULL;
  threadTaskExecutor.stealableCount = 0;
  threadTaskExecutor.schedulerManager = schedulerManager;
  InitBaseExecutorEnv();
  CopyStackInitByDefault();
  EnablePreemptionWith(PreemptionHandlerExecuteNextTask);
  DisablePreemptionSignal();
  ForkFunctionTableToThread();
  GetCopyStackLocations(&threadTaskExecutor);
  CreatePlatformMutex(&(threadTaskExecutor.mtxReadyQueue));
  CreatePlatformMutex(&(threadTaskExecutor.mtxTimer));
  CreatePlatformConditionVariable(&(threadTaskExecutor.cvReadyQueue));
  CreatePlatformSemaphore(&(threadTaskExecutor.startSem), 0);
  CreatePlatformSemaphore(&(threadTaskExecutor.endSem), 0);
  list_init(&(threadTaskExecutor.readyQueue));
  list_insert_back(&(schedulerManager->schedulers),
                   &(threadTaskExecutor.executorHook));
  timeouts_init(&(threadTaskExecutor.executorTimer), 0);
  RefreshTimer(&threadTaskExecutor);
  if (args->initEnv) args->initEnv(args->initArg);
  PlatformSemaphoreSignal(semBegin);
  PlatformSemaphoreWait(&(threadTaskExecutor.startSem));
  while (__atomic_load_n(&(schedulerManager->isRunning), __ATOMIC_ACQUIRE)) {
    TaskCommonHeader *toExecute;
    GetNextTaskFromExecutor(&toExecute);
    if (toExecute) {
      ContextSwitchToTaskImpl(toExecute);
      CleanupPreviousTask();
    } else {
      break;
    }
  }
  PlatformSemaphoreSignal(&(threadTaskExecutor.endSem));
  PlatformSemaphoreWait(&(threadTaskExecutor.startSem));
  DestroyPlatformSemaphore(&(threadTaskExecutor.startSem));
  DestroyPlatformConditionVariable(&(threadTaskExecutor.cvReadyQueue));
  DestroyPlatformMutex(&(threadTaskExecutor.mtxReadyQueue));
  DestroyPlatformMutex(&(threadTaskExecutor.mtxTimer));
  return NULL;
}

static inline int ClearTimerFor(BaseTaskExecutor *currExecutor) {
  jamCall(__ContextSpinMutexInternalLock(&(currExecutor->mtxTimer)), 1);
  struct timeout *timedWait;
  jamCall(RefreshTimer(currExecutor), 1);
  while ((timedWait = timeouts_get(&(currExecutor->executorTimer)))) {
    TaskCommonHeader *taskWait =
        (TaskCommonHeader *)(((uintptr_t)timedWait) -
                             offsetof(TaskCommonHeader, timeOut));
    ContextConditionVariable *cvWait =
        __atomic_load_n(&(taskWait->cvWaiting), __ATOMIC_ACQUIRE);
    if (cvWait) {
      jamCall(__ContextSpinMutexInternalLock(&(cvWait->mutex)), 1);
      if (!__atomic_exchange_n(&(taskWait->cvStatus), 1, __ATOMIC_ACQ_REL)) {
        list_remove(&(cvWait->waitQueue), &(taskWait->elemHook));
        jamCall(EnableTask(taskWait), 1);
      }
      jamCall(__ContextSpinMutexInternalUnlock(&(cvWait->mutex)), 1);
    } else {
      jamCall(EnableTask(taskWait), 1);
    }
  }
  jamCall(__ContextSpinMutexInternalUnlock(&(currExecutor->mtxTimer)), 1);
  return 0;
}

static void *InstallTimer(void *vargs) {
  argTimer = *((__ArgumentTimer *)vargs);
  BaseTaskExecutor *startExecutor = (BaseTaskExecutor *)list_at(
      &((argTimer.schedulerManager)->schedulers), argTimer.startIdx);
  list_insert_back(&(argTimer.schedulerManager->timers), &(argTimer.timerHook));
  ((__ArgumentTimer *)vargs)->timerThreadId = PlatformGetCurrentThread();
  PlatformSemaphoreSignal(&(((__ArgumentTimer *)vargs)->semStart));
  // PlatformSemaphoreWait(&(((__ArgumentTimer *)vargs)->semEnd));
  while (__atomic_load_n(&(argTimer.schedulerManager->isTimerRunning),
                         __ATOMIC_ACQUIRE)) {
    BaseTaskExecutor *currExecutor = startExecutor;
    for (size_t i = 0; i < argTimer.len; i++) {
      assert(currExecutor);
      ClearTimerFor(currExecutor);
      currExecutor = (BaseTaskExecutor *)list_next((ListNode *)currExecutor);
    }
    if (!currExecutor) {  // last pooler
      if (argTimer.schedulerManager->rtsyExecutor) {
        RTSYExecutor *rtsyExecutor = argTimer.schedulerManager->rtsyExecutor;
        struct timespec now;
        Maintenant(&now);
        uint64_t latestPreemptPoint = __atomic_exchange_n(
            &(rtsyExecutor->preemptAt), 0, __ATOMIC_ACQUIRE);
        if (latestPreemptPoint &&
            latestPreemptPoint < ConvertTimeSpecToNanoseconds(now)) {
          PreemptThread(&(rtsyExecutor->baseTaskExecutor.threadId));
        }
        ClearTimerFor(&(rtsyExecutor->baseTaskExecutor));
      }
    }
    PlatformSleep(&(argTimer.deltaSleep));
  }
  // PlatformSemaphoreWait(&(((__ArgumentTimer *)vargs)->semEnd));
  DestroyPlatformSemaphore(&(argTimer.semStart));
  // DestroyPlatformSemaphore(&(argTimer.semEnd));
  return NULL;
}

//
// Scheduler Manager API
//

int CreateSchedulerManager(void *lpSchedManager) {
  SchedulerManager *schedManager = lpSchedManager;
  list_init(&(schedManager->schedulers));
  list_init(&(schedManager->timers));
  schedManager->rtsyExecutor = NULL;
  __atomic_store_n(&(schedManager->isRunning), 1, __ATOMIC_RELEASE);
  __atomic_store_n(&(schedManager->isTimerRunning), 1, __ATOMIC_RELEASE);
  return 0;
}

int WaitAndClearSchedulerManager(void *lpSchedManager) {
  SchedulerManager *schedulerManager = lpSchedManager;
  ListNode *cur, *bak;
  list_for_each(cur, &(schedulerManager->schedulers)) {
    jamCall(PlatformSemaphoreWait(&(((BaseTaskExecutor *)cur)->endSem)), 1);
  }
  __atomic_store_n(&(schedulerManager->isTimerRunning), 0, __ATOMIC_RELEASE);
  list_for_each_safe(cur, bak, &(schedulerManager->timers)) {
    // DetachPlatformThread(&(((__ArgumentTimer *)cur)->timerThreadId));
    list_remove(&(schedulerManager->timers), cur);
    jamCall(PlatformSemaphoreSignal(&(((__ArgumentTimer *)cur)->semEnd)), 1);
    jamCall(WaitPlatformThread(&(((__ArgumentTimer *)cur)->timerThreadId)), 1);
  }
  list_for_each_safe(cur, bak, &(schedulerManager->schedulers)) {
    list_remove(&(schedulerManager->schedulers), cur);
    jamCall(PlatformSemaphoreSignal(&(((BaseTaskExecutor *)cur)->startSem)), 1);
    jamCall(WaitPlatformThread(&(((BaseTaskExecutor *)cur)->threadId)), 1);
  }
  return 0;
}

int BeginAllExecutors(void *lpSchedManager) {
  ListNode *curr;
  SchedulerManager *schedulerManager = lpSchedManager;
  list_for_each(curr, &(schedulerManager->schedulers)) {
    jamCall(PlatformSemaphoreSignal(&(((BaseTaskExecutor *)curr)->startSem)),
            1);
  }
  return 0;
}

int EndAllExecutors(void *lpSchedManager) {
  ListNode *curr;
  SchedulerManager *schedulerManager = lpSchedManager;
  __atomic_store_n(&(schedulerManager->isRunning), 0, __ATOMIC_RELEASE);
  list_for_each(curr, &(schedulerManager->schedulers)) {
    jamCall(PlatformConditionVariableSignal(
                &(((BaseTaskExecutor *)curr)->cvReadyQueue)),
            1);
  }
  return 0;
}

int AddExecutor(void *lpSchedManager, void (*initEnv)(void *), void *initArg) {
  PlatformSemaphore semBegin;
  PlatformThread tid;
  __AddExecutorArgType args;
  args.schedulerManager = lpSchedManager;
  args.semBegin = &semBegin;
  args.initEnv = initEnv;
  args.initArg = initArg;
  jamCall(CreatePlatformSemaphore(&semBegin, 0), 1);
  jamCall(CreatePlatformThread(&tid, InstallExecutor, &args), 1);
  jamCall(PlatformSemaphoreWait(&semBegin), 1);
  jamCall(DestroyPlatformSemaphore(&semBegin), 1);
  return 0;
}

int AddTimer(void *lpSchedManager, size_t count, struct timespec delta) {
  SchedulerManager *schedManager = lpSchedManager;
  size_t currExecutorIdx = 0U;
  size_t numOfExecutors = list_size(&(schedManager->schedulers));
  if (schedManager && numOfExecutors >= count) {
    size_t perTimerCount = count / numOfExecutors;
    while (count--) {
      __ArgumentTimer argTimer;
      argTimer.deltaSleep = delta;
      argTimer.len =
          (count) ? (perTimerCount) : (numOfExecutors - currExecutorIdx);
      argTimer.startIdx = currExecutorIdx;
      argTimer.schedulerManager = schedManager;
      CreatePlatformSemaphore(&(argTimer.semStart), 0);
      CreatePlatformSemaphore(&(argTimer.semEnd), 0);
      CreatePlatformThread(&(argTimer.timerThreadId), InstallTimer, &argTimer);
      PlatformSemaphoreWait(&(argTimer.semStart));
      DestroyPlatformSemaphore(&(argTimer.semStart));
      currExecutorIdx += perTimerCount;
    }
  }
  return 0;
}
#include "mqtt_manager.h"
void *InstallStatsPrinter(void *lpManager) {
  SchedulerManager *schedulerManager = lpManager;
  ListNode *baseTaskExecutor = NULL;
  while (__atomic_load_n(&(schedulerManager->isRunning), __ATOMIC_ACQUIRE)) {
    printf("queue sizes are ");
    list_for_each(baseTaskExecutor, &(schedulerManager->schedulers)) {
      printf("%llu ", list_size(&(((BaseTaskExecutor *)baseTaskExecutor)->readyQueue)));
    }
    printf(", size of dedup table %llu\n", GetDeduplicationTableSize());
    struct timespec ts = (struct timespec){0, 200000000};
    PlatformSleep(&ts);
  }
  return NULL;
}