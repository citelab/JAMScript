#include "timer.h"
#include "baseexecutor.h"

static inline int AddToTimerByMonitor(
    Timer *timer, TaskCommonHeader *task, uint64_t absTimeNanoSecs) {
  jamCall(__ContextSpinMutexInternalLock(&(timer->mtx)), 1);
  timeouts_add(&(timer->timingWheel), &(task->timeOut), absTimeNanoSecs);
  jamCall(__ContextSpinMutexInternalUnlock(&(timer->mtx)), 1);
}

static inline int RemoveFromTimerInternal(Timer *timer, TaskCommonHeader *task) {
  timeouts_del(&(timer->timingWheel), &(task->timeOut));
}