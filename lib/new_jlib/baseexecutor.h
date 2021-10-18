#pragma once
#ifdef __cplusplus
extern "C" {
#endif
#include <time.h>

#include "list.h"
#include "platformsync.h"
#include "sync.h"
#include "timeout.h"
#include "context.h"

typedef int (*ContextCreatorType)(void *, unsigned long int, void (*)(void));

/**
 * For all return code
 * 0: normal
 * 1: error
 */ 

/**
 * Create Batch Task
 * @fn CreateBatchTask
 * @param lpTask: pointer to memory allocated for task, must be at least sizeof(BatchTaskHeader)
 * @param FnCreateTask: could be CreateContext or CreateCopyStackContext
 * @param stackSize: size of stack within @ref lpTask
 * @param fn: function to be executed by task 
 * @remark Task is not eligable to run until enable it using @ref EnableTask or
 *         @ref EnableTaskOnExecutorWithMinimumNumberOfTask
 * @remark Setting argument for task using @ref SetTaskData
 * @remark Retreving argument for task using @ref GetTaskData
 */
int CreateBatchTask(void *lpTask, ContextCreatorType FnCreateTask,
                    unsigned long stackSize, void (*fn)(void));

/**
 * Destroy Batch Task
 * Clear lpTask memory
 */ 
int DestroyBatchTask(void *lpTask);

/**
 * Enable Task
 * By adding to executor with least number of task
 * @param _task: task to enable
 * @param _schedManager: scheduler manager task would run on
 * @remark Could be called from inside task and outside task
 * @warning Do not operate on @ref _task after this function outside task, otherwise data race is possible
 */ 
int EnableTaskOnExecutorWithMinimumNumberOfTask(void *_task,
                                                void *_schedManager);
int EnableTaskOnIndexedExecutor(void *_task, void *_schedManager, size_t n);
                                        
/**
 * Enable Task
 * By adding to the front of the ready queue of the current executor
 * @param _task: task to enable
 * @warning Could be called only from inside task
 * @warning Do not operate on @ref _task after this function outside task, otherwise data race is possible
 */ 
int EnableTask(void *_task);

int EnableTaskOnCurrentExecutor(void *_task);
int FixTaskToItsCore(void *ucp);
int UnFixTaskToItsCore(void *ucp, int val);

/**
 * Get Active Task
 * Get pointer to task that is running
 * @param _task: pointer to pointer to task, used to return task pointer value
 * @warning Could be called only from inside task
 */
int GetActiveTask(void *_task);

/**
 * Yield Task
 * Put task into end of ready queue of current 
 * @warning Could be called only from inside task
 * 
 */
int RelinquishTask(void);

/**
 * Yield Task
 * Adding the current task to end of ready queue of the current executor and 
 * pop and swap to the task in the front of ready queue
 * @warning Could be called only from inside task
 */
int FinishTask(void);

/**
 * Begin Task
 * clean up previous task, reset signal flag if swapped from a preempted task
 * @warning Must be inserted as the first statement of the task function
 * @warning Could be called only from inside task
 */
int BeginTask(void);

/**
 * Next Task
 * pop and swap to the task in the front of ready queue 
 * without putting the current task into ready queue
 * @warning Could be called only from inside task
 */
int NextTask(void);

/**
 * Set Task Data
 * Set the void *data entry of the context of the task pointed by @ref ucp to @ref dt
 */
int SetTaskData(void *ucp, void *dt);

/**
 * Get Task Data
 * Get the void *data entry of the context of the task pointed by @ref ucp
 * value returned into word sized memory pointed @ref datap
 */
int GetTaskData(void *datap, void *ucp);

/**
 * Wait for Task Until Finish
 * Return until the task waiting to be finished
 * commonly used to wait until a task finished and collect its memory 
 * Modification to task has no data race after this function returns
 * @warning Could be called only from inside task
 */
int WaitForTaskUntilFinish(void *_lptask);

/**
 * Task sleep for
 * sleep task for tc, scheduler will run other tasks while sleeping, 
 * and get back to task when time is up 
 * @param tc: time interval for sleeping
 * @warning Could be called only from inside task
 */
int CurrentTaskWaitFor(struct timespec tc);

/**
 * Create Scheduler Manager
 * @param lpSchedManager: pointer to memory allocated for scheduler manager, must be of sizeof(SchedulerManager)
 */
int CreateSchedulerManager(void *lpSchedManager);

/**
 * Add a new Executor (scheduler) to Scheduler Manager
 * @param lpSchedManager: scheduler manager for new executor to be added on
 * @param initEnv: used to initialize user-defined __thread thread local variables before execution of first task
 */ 
int AddExecutor(void *lpSchedManager, void (*initEnv)(void *), void *initArg);

int AddTimer(void *lpSchedManager, size_t count, struct timespec delta);

/**
 * Begin all Executor of a Scheduler Manager
 * @param lpSchedManager: the Scheduler Manager to begin 
 */
int BeginAllExecutors(void *lpSchedManager);

/**
 * End all Executor of a Scheduler Manager
 * @param lpSchedManager: the Scheduler Manager to end
 */
int EndAllExecutors(void *lpSchedManager);

/**
 * Collect OS resources allocated for scheduler manager
 * @param lpSchedManager: the Scheduler Manager to collect
 */
int WaitAndClearSchedulerManager(void *lpSchedManager);

int CleanupPreviousTaskBaseExecutorImpl(void);
void *InstallStatsPrinter(void *lpManager);
void InitBaseExecutorEnv();
typedef struct __SchedulerManager {
  List schedulers, timers;
  void *rtsyExecutor;
  unsigned int isRunning, isTimerRunning;
} SchedulerManager;

/**
 * Base Task Executor
 * Coroutine Executor managed under schedulerManager
 * A thread that runs coroutine
 * If coroutines runs out, find another executor under same schedulerManager
 * that contains >1 tasks, then steal half of the tasks from that executor
 * Timer is responsible of coroutine sleep and monitor timed wait
 */ 
typedef struct _BaseTaskExecutor {
  ListNode executorHook;
  List readyQueue;
  PlatformSemaphore startSem;
  PlatformSemaphore endSem;
  PlatformThread threadId;
  PlatformConditionVariable cvReadyQueue;
  PlatformMutex mtxReadyQueue, mtxTimer;
  SchedulerManager *schedulerManager;
  unsigned long int sharedStackBeginPtr;
  unsigned long int sharedStackEndPtr;
  size_t stealableCount;
  int (*NextTask)(void);
  int (*EnableTask)(void*);
  int (*CleanupPreviousTask)(void);
  struct timeouts executorTimer;
} BaseTaskExecutor;

/**
 * Task Common Header
 * Memory Layout of a task (on 64bits architecture): 88 bytes
 * (Each line represents a QWORD)
 * |elemHook::prev                                                            |
 * |elemHook::next                                                            |
 * |task invariant properties                                                 |
 * |condition variable task may waiting for                                   |
 * |condition variable wait status       |is task movable task                |
 * |executor running it                                                       |
 * |joinQueue::waitQueue::head                                                |
 * |joinQueue::waitQueue::tail                                                |
 * |joinQueue::waitQueue::size                                                |
 * |joinQueue::count                                                          |
 * |joinQueue::lockQWord                                                      |
 */ 
typedef struct _TaskCommonHeader {
  ListNode elemHook;
  unsigned long int isRealTimeTask : 1;
  unsigned long int isBatchTask : 1;
  unsigned long int isInteractiveTask : 1;
  unsigned long int isTaskFinished : 1;
  unsigned long int isSyncBarrierTask : 1;
  unsigned long int isTaskStealable : 1;
  void* cvWaiting, *deferArgs;
  void (*Defer)(void *);
  unsigned int cvStatus;
  unsigned int isMovableTask;
  BaseTaskExecutor *executor;
  ContextSemaphore joinQueue;
  struct timeout timeOut;
} TaskCommonHeader;

#define JAMC_USER_BATCH_MEMBERS TaskCommonHeader header;

/**
 * Batch Task Header
 * 88 bytes + 104 bytes = 192 bytes
 */
typedef struct _BatchTaskHeader {
  JAMC_USER_BATCH_MEMBERS
  JAMScriptUserContextHeader ctxh;
} BatchTaskHeader;

#define JAMC_USER_RT_MEMBERS \
  TaskCommonHeader header;   \
  uint64_t slotId;

typedef struct _TaskRTHeader {
  JAMC_USER_RT_MEMBERS
  JAMScriptUserContextHeader ctxh;
} RealTimeTaskHeader;

#define JAMC_USER_IT_MEMBERS \
  TaskCommonHeader header;   \
  struct timespec deadline;

typedef struct _TaskITHeader {
  JAMC_USER_IT_MEMBERS
  JAMScriptUserContextHeader ctxh;
} InteractiveTaskHeader;

#define JAMC_USER_SB_MEMBERS \
  TaskCommonHeader header;   \
  char controllerUuid[33];

typedef struct _TaskSBHeader {
  JAMC_USER_SB_MEMBERS
  JAMScriptUserContextHeader ctxh;
} SyncBarrierTaskHeader;

int ContextSwitchToTask(TaskCommonHeader *taskHeader);
int GetExecutorIndex(BaseTaskExecutor *, SchedulerManager *);

/**
 * Declare Batch Task
 * Allocate memory of Batch Task on stack or data segment 
 * @param cn: name of batch task variable
 * @param ssz: stack size of batch task
 */
#define DeclBatchTask(cn, ssz)                    \
  unsigned char cn[sizeof(BatchTaskHeader) + ssz] \
      __attribute__((aligned(JAMC_STACK_ALIGNMENT)))

/**
 * Declare Array Batch Task
 * Allocate memory of an array of Batch Task on stack or data segment 
 * @param cls: class of variable, could be staic, 
 * @param cn: name of batch task variable
 * @param ssz: stack size of (all) batch tasks
 * @param listSize: number of batch tasks to allocate
 */
#define DeclBatchTaskArray(cls, cn, ssz, listSize)      \
  typedef struct ____BatchTask##ssz {                   \
    unsigned char __cn[sizeof(BatchTaskHeader) + ssz]   \
        __attribute__((aligned(JAMC_STACK_ALIGNMENT))); \
  } __BatchTask##ssz;                                   \
  cls __BatchTask##ssz cn[listSize]

#ifdef __cplusplus
}
#endif