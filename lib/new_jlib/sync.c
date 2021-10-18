#include "sync.h"

#include "baseexecutor.h"
#include "context.h"

/**
 * Enable a task in a wait queue
 * @param waitQueue: wait queue to wake up 1 task on
 * @warning: must be called with lock of wait queue locked
 */
static inline int __ContextNotifyOneInternal(List *waitQueue) {
  if (!list_empty(waitQueue)) {
    TaskCommonHeader *task2enable = (TaskCommonHeader *)list_front(waitQueue);
    __atomic_store_n(&(task2enable->cvStatus), 1, __ATOMIC_RELEASE);
    list_remove_front(waitQueue);
    jamCall(EnableTask(task2enable), 1);
  }
  return 0;
}

int CreateContextSemaphore(void *lpSem, long int cn) {
  ContextSemaphore *sem = lpSem;
  __atomic_store_n(&(sem->count), cn, __ATOMIC_RELEASE);
  jamCall(__CreateContextSpinMutexInternal(&(sem->mutex)), 1);
  list_init(&(sem->waitQueue));
  return 0;
}

int DestroyContextSemaphore(void *lpSem) {
  ContextSemaphore *sem = lpSem;
  jamCall(__DestroyContextSpinMutexInternal(&(sem->mutex)), 1);
  return 0;
}

int ContextSemaphoreWait(void *lpSem) {
  ContextSemaphore *sem = lpSem;
  void *taskActive;
  jamCall(GetActiveTask(&taskActive), 1);
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(sem->mutex)), 1);
  while (__atomic_load_n(&(sem->count), __ATOMIC_ACQUIRE) <= 0) {
    if (unlikely(!taskActive)) {
      return 1;
    }
    list_insert_back(&(sem->waitQueue), taskActive);
    jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(sem->mutex)), 1);
    jamCallEnablePreemption(NextTask(), 1);
    jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(sem->mutex)), 1);
  }
  __atomic_sub_fetch(&(sem->count), 1, __ATOMIC_ACQ_REL);
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(sem->mutex)), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int ContextSemaphoreSignal(void *lpSem) {
  ContextSemaphore *sem = lpSem;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(sem->mutex)), 1);
  __atomic_add_fetch(&(sem->count), 1, __ATOMIC_ACQ_REL);
  jamCallEnablePreemption(__ContextNotifyOneInternal(&(sem->waitQueue)), 1);
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(sem->mutex)), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int ContextSemaphoreSignalAll(void *lpSem) {
  ContextSemaphore *sem = lpSem;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(sem->mutex)), 1);
  __atomic_store_n(&(sem->count), 0x7FFFFFFFFFFFFFFF, __ATOMIC_RELEASE);
  while (!list_empty(&(sem->waitQueue))) {
    jamCallEnablePreemption(__ContextNotifyOneInternal(&(sem->waitQueue)), 1);
  }
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(sem->mutex)), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int CreateContextConditionVariable(void *lpCondVar) {
  ContextConditionVariable *condVar = lpCondVar;
  jamCall(__CreateContextSpinMutexInternal(&(condVar->mutex)), 1);
  list_init(&(condVar->waitQueue));
  return 0;
}

int DestroyContextConditionVariable(void *lpCondVar) {
  ContextConditionVariable *condVar = lpCondVar;
  jamCall(__DestroyContextSpinMutexInternal(&(condVar->mutex)), 1);
  return 0;
}

int ContextConditionVariableWait(void *lpCondVar, void *lpMutex) {
  ContextConditionVariable *cv = lpCondVar;
  ContextMutex *mtx = lpMutex;
  TaskCommonHeader *taskActive;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(GetActiveTask(&taskActive), 1);
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(cv->mutex)), 1);
  list_insert_back(&(cv->waitQueue), &(taskActive->elemHook));
  __atomic_store_n(&(taskActive->cvWaiting), cv, __ATOMIC_RELEASE);
  __atomic_store_n(&(taskActive->cvStatus), 0, __ATOMIC_RELEASE);
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(cv->mutex)), 1);
  jamCallEnablePreemption(ContextMutexUnlock(mtx), 1);
  jamCallEnablePreemption(NextTask(), 1);
  __atomic_store_n(&(taskActive->cvWaiting), 0, __ATOMIC_RELEASE);
  jamCallEnablePreemption(ContextMutexLock(mtx), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

/**
 * Generalized implementation of CV timed wait
 * @param cv: cv to wait
 * @param mtx: mutex assoc'd with the cv to wait
 * @param timePoint: timepoint to wait until,
 *                   noted as Nanoseconds from
 *                   beginning of Unix time epoch (1970)
 * @warning: mutex @ref mtx must be locked
 */
int ContextConditionVariableWaitFor(void *lpCondVar, void *lpMutex,
                                    struct timespec timeInterval) {
  struct timespec absTime;
  TaskCommonHeader *taskActive;
  PlatformMutex *prevExecutorMtx;
  ContextConditionVariable *cv = lpCondVar;
  ContextMutex *mtx = lpMutex;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(GetActiveTask(&taskActive), 1);
  int prevStat = FixTaskToItsCore(taskActive);
  jamCallEnablePreemption(
      __ContextSpinMutexInternalLock(&(taskActive->executor->mtxTimer)), 1);
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(cv->mutex)), 1);
  list_insert_back(&(cv->waitQueue), &(taskActive->elemHook));
  __atomic_store_n(&(taskActive->cvWaiting), cv, __ATOMIC_RELEASE);
  __atomic_store_n(&(taskActive->cvStatus), 0, __ATOMIC_RELEASE);
  // add task to timer
  jamCall(RelativeTimeToAbsoluteTimeTimeSpec(&absTime, timeInterval), 1);
  timeout_init(&(taskActive->timeOut), TIMEOUT_ABS);
  timeouts_add(&(taskActive->executor->executorTimer), &(taskActive->timeOut),
               ConvertTimeSpecToNanoseconds(absTime));
  prevExecutorMtx = &(taskActive->executor->mtxTimer);
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(cv->mutex)), 1);
  jamCallEnablePreemption(
      __ContextSpinMutexInternalUnlock(&(taskActive->executor->mtxTimer)), 1);
  jamCallEnablePreemption(ContextMutexUnlock(mtx), 1);
  // swap out
  jamCallEnablePreemption(NextTask(), 1);
  jamCallEnablePreemption(ContextMutexLock(mtx), 1);
  // remove from timer
  jamCallEnablePreemption(
      __ContextSpinMutexInternalLock(prevExecutorMtx), 1);
  if (timeout_pending(&(taskActive->timeOut))) {
    timeout_del(&(taskActive->timeOut));
  }
  jamCallEnablePreemption(
      __ContextSpinMutexInternalUnlock(prevExecutorMtx), 1);
  __atomic_store_n(&(taskActive->cvWaiting), 0, __ATOMIC_RELEASE);
  UnFixTaskToItsCore(taskActive, prevStat);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int ContextConditionVariableNotifyOne(void *lpCondVar) {
  ContextConditionVariable *cv = lpCondVar;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(cv->mutex)), 1);
  if (!list_empty(&(cv->waitQueue))) {
    jamCallEnablePreemption(__ContextNotifyOneInternal(&(cv->waitQueue)), 1);
  }
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(cv->mutex)), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int ContextConditionVariableNotifySpecific(void *lpCondVar, void *lpTask) {
  ContextConditionVariable *cv = lpCondVar;
  TaskCommonHeader *tc = lpTask;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(cv->mutex)), 1);
  if (tc->elemHook.prev != LIST_POISON_PREV ||
      tc->elemHook.next != LIST_POISON_NEXT) {
    list_remove(&(cv->waitQueue), &(tc->elemHook));
  }
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(cv->mutex)), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int ContextConditionVariableNotifyAll(void *lpCondVar) {
  ContextConditionVariable *cv = lpCondVar;
  JAMC_DISABLE_PREEMPTION_BEGIN;
  jamCallEnablePreemption(__ContextSpinMutexInternalLock(&(cv->mutex)), 1);
  while (!list_empty(&(cv->waitQueue))) {
    jamCallEnablePreemption(__ContextNotifyOneInternal(&(cv->waitQueue)), 1);
  }
  jamCallEnablePreemption(__ContextSpinMutexInternalUnlock(&(cv->mutex)), 1);
  JAMC_DISABLE_PREEMPTION_END;
  return 0;
}

int CreateContextMutex(void *lpMutex) {
  return CreateContextSemaphore(lpMutex, 1);
}

int ContextMutexLock(void *lpMutex) { return ContextSemaphoreWait(lpMutex); }

int ContextMutexUnlock(void *lpMutex) {
  return ContextSemaphoreSignal(lpMutex);
}

int DestroyContextMutex(void *lpMutex) {
  return DestroyContextSemaphore(lpMutex);
}