#pragma once
#ifdef __cplusplus
extern "C" {
#endif
#include "config.h"
#include "list.h"
#include "spinlock.h"
#include <time.h>
/**
 * Create Context Semaphore
 * Init semaphore used for jamc2 task context
 * @param lpSem: pointer to memory to init semaphore on
 * @param cn: count of the semaphore
 */
int CreateContextSemaphore(void *lpSem, long int cn);

/**
 * Destroy Context Semaphore
 * Release resource used by jamc2 context semaphore
 * @param lpSem: pointer to memory to delete semaphore on
 */
int DestroyContextSemaphore(void *lpSem);

/**
 * Context Semaphore Wait
 * Wait operation on input jamc2 context semaphore
 * @param lpSem: pointer to semaphore to wait
 * @warning: Must be called inside a jamc2 task
 */
int ContextSemaphoreWait(void *lpSem);

/**
 * Context Semaphore Signal
 * Signal operation on input jamc2 context semaphore
 * @param lpSem: pointer to semaphore to signal
 * @warning: Must be called inside a jamc2 task
 */
int ContextSemaphoreSignal(void *lpSem);

/**
 * Context Semaphore Signal
 * Signal all waiting threads on input jamc2 context semaphore and 
 * set count of the semaphore to max value of word sized sign integer 
 * Intended only for internal use in @ref WaitForTaskUntilFinish
 * @param lpSem: pointer to semaphore to signal
 * @warning: Must be called inside a jamc2 task
 */
int ContextSemaphoreSignalAll(void *lpSem);

/**
 * Create Context Condition Variable
 * Init condition variable used for jamc2 task context
 * @param lpCondVar: pointer to memory to init condition variable on
 */
int CreateContextConditionVariable(void *lpCondVar);

/**
 * Context Condition Variable Wait
 * Wait operation on input jamc2 context condition variable
 * @param lpCondVar: pointer to condition variable to wait
 * @param lpMutex: pointer to locked mutex associated with the cv to wait
 * @warning: Must be called inside a jamc2 task
 * @warning: @ref lpMutex must be a ContextMutex
 * @warning: @ref lpMutex must be locked
 */
int ContextConditionVariableWait(void *lpCondVar, void *lpMutex);

/**
 * Context Condition Variable Wait For
 * Wait operation on input jamc2 context condition variable until timeout
 * @param lpCondVar: pointer to condition variable to wait
 * @param lpMutex: pointer to locked mutex associated with the cv to wait
 * @param lpTimeOut: pointer to struct timespec that represents a time duration
 * @warning: Must be called inside a jamc2 task
 * @warning: @ref lpMutex must be a ContextMutex
 * @warning: @ref lpMutex must be locked
 * @warning: timer has to be initiallized
 */
int ContextConditionVariableWaitFor(void *lpCondVar, void *lpMutex, 
                                    struct timespec timeInterval);
/**
 * Context Condition Variable Notify One
 * Notify 1 thread waiting in jamc2 context condition variable (if there exists one)
 * @param lpCondVar: pointer to condition variable to notify
 * @warning: Must be called inside a jamc2 task
 */
int ContextConditionVariableNotifyOne(void *lpCondVar);

/**
 * Context Condition Variable Notify One
 * Notify 1 thread waiting in jamc2 context condition variable (if there exists one)
 * @param lpCondVar: pointer to condition variable to notify
 * @warning: Must be called inside a jamc2 task
 */
int ContextConditionVariableNotifySpecific(void *lpCondVar, void *lpTask);

/**
 * Context Condition Variable Notify All
 * Notify all threads waiting in jamc2 context condition variable
 * @param lpCondVar: pointer to condition variable to notify
 * @warning: Must be called inside a jamc2 task
 */
int ContextConditionVariableNotifyAll(void *lpCondVar);

/**
 * Destroy Context Condition Variable
 * Destroy jamc2 context condition variable
 * @param lpCondVar: pointer to condition variable to destroy
 */
int DestroyContextConditionVariable(void *lpCondVar);

// Context Mutex is implemented directly using Context Semaphore with count = 1

/**
 * CreateContextMutex
 * Equivalent to CreateContextSemaphore(lpMutex, 1)
 */
int CreateContextMutex(void *lpMutex);

/**
 * ContextMutexLock
 * Equivalent to ContextSemaphoreWait(lpMutex)
 */
int ContextMutexLock(void *lpMutex);

/**
 * ContextMutexUnlock
 * Equivalent to ContextSemaphoreSignal(lpMutex)
 */
int ContextMutexUnlock(void *lpMutex);

typedef struct _ContextConditionVariable {
  List waitQueue;
  __ContextSpinMutexInternal mutex;
} ContextConditionVariable;

typedef struct _ContextSemaphore {
  List waitQueue;
  long int count;
  __ContextSpinMutexInternal mutex;
} ContextSemaphore;

typedef struct _ContextMutex {
  ContextSemaphore binarySemaphore;
} ContextMutex;
#ifdef __cplusplus
}
#endif
