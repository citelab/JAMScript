#pragma once

#include <errno.h>
#include <pthread.h>
#include <signal.h>
#include <time.h>
#include <assert.h>
#include <stdint.h>
#include <unistd.h>

#include "config.h"
#include "spinlock.h"

/* Functions for working with timespec structures
 * Written by Daniel Collins (2017)
 * timespec_mod by Alex Forencich (2019)
 *
 * This is free and unencumbered software released into the public domain.
 *
 * Anyone is free to copy, modify, publish, use, compile, sell, or
 * distribute this software, either in source code form or as a compiled
 * binary, for any purpose, commercial or non-commercial, and by any
 * means.
 *
 * In jurisdictions that recognize copyright laws, the author or authors
 * of this software dedicate any and all copyright interest in the
 * software to the public domain. We make this dedication for the benefit
 * of the public at large and to the detriment of our heirs and
 * successors. We intend this dedication to be an overt act of
 * relinquishment in perpetuity of all present and future rights to this
 * software under copyright law.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * For more information, please refer to <http://unlicense.org/>
 */

#define NSEC_PER_SEC 1000000000

static inline struct timespec timespec_normalise(struct timespec ts) {
  while (ts.tv_nsec >= NSEC_PER_SEC) {
    ++(ts.tv_sec);
    ts.tv_nsec -= NSEC_PER_SEC;
  }

  while (ts.tv_nsec <= -NSEC_PER_SEC) {
    --(ts.tv_sec);
    ts.tv_nsec += NSEC_PER_SEC;
  }

  if (ts.tv_nsec < 0) {
    /* Negative nanoseconds isn't valid according to POSIX.
     * Decrement tv_sec and roll tv_nsec over.
     */

    --(ts.tv_sec);
    ts.tv_nsec = (NSEC_PER_SEC + ts.tv_nsec);
  }

  return ts;
}

/** \fn bool timespec_lt(struct timespec ts1, struct timespec ts2)
 *  \brief Returns true if ts1 is less than ts2.
*/
static inline int timespec_lt(struct timespec ts1, struct timespec ts2)
{
	ts1 = timespec_normalise(ts1);
	ts2 = timespec_normalise(ts2);
	
	return (ts1.tv_sec < ts2.tv_sec || (ts1.tv_sec == ts2.tv_sec && ts1.tv_nsec < ts2.tv_nsec));
}

/** \fn bool timespec_le(struct timespec ts1, struct timespec ts2)
 *  \brief Returns true if ts1 is less than or equal to ts2.
*/
static inline int timespec_le(struct timespec ts1, struct timespec ts2)
{
	ts1 = timespec_normalise(ts1);
	ts2 = timespec_normalise(ts2);
	
	return (ts1.tv_sec < ts2.tv_sec || (ts1.tv_sec == ts2.tv_sec && ts1.tv_nsec <= ts2.tv_nsec));
}

/** \fn bool timespec_gt(struct timespec ts1, struct timespec ts2)
 *  \brief Returns true if ts1 is greater than ts2.
*/
static inline int timespec_gt(struct timespec ts1, struct timespec ts2)
{
	ts1 = timespec_normalise(ts1);
	ts2 = timespec_normalise(ts2);
	
	return (ts1.tv_sec > ts2.tv_sec || (ts1.tv_sec == ts2.tv_sec && ts1.tv_nsec > ts2.tv_nsec));
}

/** \fn bool timespec_ge(struct timespec ts1, struct timespec ts2)
 *  \brief Returns true if ts1 is greater than or equal to ts2.
*/
static inline int timespec_ge(struct timespec ts1, struct timespec ts2)
{
	ts1 = timespec_normalise(ts1);
	ts2 = timespec_normalise(ts2);
	
	return (ts1.tv_sec > ts2.tv_sec || (ts1.tv_sec == ts2.tv_sec && ts1.tv_nsec >= ts2.tv_nsec));
}

/** \fn struct timespec timespec_add(struct timespec ts1, struct timespec ts2)
 *  \brief Returns the result of adding two timespec structures.
 */
static inline struct timespec timespec_add(struct timespec ts1,
                                           struct timespec ts2) {
  /* Normalise inputs to prevent tv_nsec rollover if whole-second values
   * are packed in it.
   */
  ts1 = timespec_normalise(ts1);
  ts2 = timespec_normalise(ts2);

  ts1.tv_sec += ts2.tv_sec;
  ts1.tv_nsec += ts2.tv_nsec;

  return timespec_normalise(ts1);
}

/** \fn struct timespec timespec_sub(struct timespec ts1, struct timespec ts2)
 *  \brief Returns the result of subtracting ts2 from ts1.
 */
static inline struct timespec timespec_sub(struct timespec ts1,
                                           struct timespec ts2) {
  /* Normalise inputs to prevent tv_nsec rollover if whole-second values
   * are packed in it.
   */
  ts1 = timespec_normalise(ts1);
  ts2 = timespec_normalise(ts2);

  ts1.tv_sec -= ts2.tv_sec;
  ts1.tv_nsec -= ts2.tv_nsec;

  return timespec_normalise(ts1);
}

static inline int PlatformSleep(struct timespec *dur) {
  return nanosleep(dur, NULL);
}

static inline int Maintenant(struct timespec *now) {
  return clock_gettime(CLOCK_REALTIME, now);
}

static inline int RelativeTimeToAbsoluteTimeTimeSpec(
    struct timespec *absTime, const struct timespec relativeTime) {
  if (unlikely(clock_gettime(CLOCK_REALTIME, absTime))) {
    return 1;
  }
  *absTime = timespec_add(*absTime, relativeTime);
  return 0;
}

static inline uint64_t ConvertTimeSpecToNanoseconds(
    const struct timespec relativeTime) {
  assert(relativeTime.tv_nsec >= 0 && relativeTime.tv_sec >= 0);
  return relativeTime.tv_nsec + relativeTime.tv_sec * NSEC_PER_SEC + 0ULL;
}

typedef pthread_t PlatformThread;
typedef __ContextSpinMutexInternal PlatformMutex;
typedef struct __PlatformConditionVariable {
  pthread_mutex_t mtx;
  pthread_cond_t cv;
} PlatformConditionVariable;

static inline int CreatePlatformThread(PlatformThread *platformThread,
                                       void *routine, void *args) {
  return pthread_create(platformThread, NULL, (void *(*)(void *))routine, args);
}

static inline int DetachPlatformThread(PlatformThread *platformThread) {
  return pthread_detach(*platformThread);
}

static inline int WaitPlatformThread(PlatformThread *platformThread) {
  return pthread_join(*platformThread, NULL);
}

static inline int KillPlatformThreadWith(PlatformThread *platformThread,
                                         int sig) {
  return pthread_kill(*platformThread, sig);
}

static inline PlatformThread PlatformGetCurrentThread() {
  return pthread_self();
}

static inline int CreatePlatformMutex(PlatformMutex *platformMutex) {
  return __CreateContextSpinMutexInternal(platformMutex);
}

static inline int PlatformMutexLock(PlatformMutex *platformMutex) {
  return __ContextSpinMutexInternalLock(platformMutex);
}

static inline int PlatformMutexUnlock(PlatformMutex *platformMutex) {
  return __ContextSpinMutexInternalUnlock(platformMutex);
}

static inline int PlatformMutexTryLock(PlatformMutex *platformMutex) {
  return __ContextSpinMutexInternalTryLock(platformMutex);
}

static inline int DestroyPlatformMutex(PlatformMutex *platformMutex) {
  return __DestroyContextSpinMutexInternal(platformMutex);
}

static inline int CreatePlatformConditionVariable(
    PlatformConditionVariable *platformCondVar) {
  jamCall(pthread_mutex_init(&(platformCondVar->mtx), NULL), 1);
  return pthread_cond_init(&(platformCondVar->cv), NULL);
}

static inline int PlatformConditionVariableSignal(
    PlatformConditionVariable *platformCondVar) {
  jamCall(pthread_mutex_lock(&(platformCondVar->mtx)), 1);
  jamCall(pthread_cond_signal(&(platformCondVar->cv)), 1);
  jamCall(pthread_mutex_unlock(&(platformCondVar->mtx)), 1);
  return 0;
}

static inline int PlatformConditionVariableWait(
    PlatformConditionVariable *platformCondVar,
    __ContextSpinMutexInternal *ctxMutex) {
  jamCall(pthread_mutex_lock(&(platformCondVar->mtx)), 1);
  jamCall(__ContextSpinMutexInternalUnlock(ctxMutex), 1);
  jamCall(pthread_cond_wait(&(platformCondVar->cv), &(platformCondVar->mtx)),
          1);
  jamCall(pthread_mutex_unlock(&(platformCondVar->mtx)), 1);
  jamCall(__ContextSpinMutexInternalLock(ctxMutex), 1);
  return 0;
}

static inline int PlatformConditionVariableWaitFor(
    PlatformConditionVariable *platformCondVar, PlatformMutex *ctxMutex,
    const struct timespec relativeTime) {
  int ret;
  struct timespec tp;
  jamCall(RelativeTimeToAbsoluteTimeTimeSpec(&tp, relativeTime), 1);
  jamCall(pthread_mutex_lock(&(platformCondVar->mtx)), 1);
  jamCall(__ContextSpinMutexInternalUnlock(ctxMutex), 1);
  ret = pthread_cond_timedwait(&(platformCondVar->cv), &(platformCondVar->mtx),
                               &tp);
  jamCall(pthread_mutex_unlock(&(platformCondVar->mtx)), 1);
  jamCall(__ContextSpinMutexInternalLock(ctxMutex), 1);
  if (ret == ETIMEDOUT || ret == 0) return 0;
  return 0;
}

static inline int DestroyPlatformConditionVariable(
    PlatformConditionVariable *platformCondVar) {
  jamCall(pthread_mutex_destroy(&(platformCondVar->mtx)), 1);
  return pthread_cond_destroy(&(platformCondVar->cv));
}

#include <semaphore.h>
typedef sem_t PlatformSemaphore;
static inline int CreatePlatformSemaphore(PlatformSemaphore *platformSemaphore,
                                          long int c) {
  return sem_init(platformSemaphore, 0, c);
}

static inline int PlatformSemaphoreWait(PlatformSemaphore *platformSemaphore) {
  return sem_wait(platformSemaphore);
}

static inline int PlatformSemaphoreSignal(
    PlatformSemaphore *platformSemaphore) {
  return sem_post(platformSemaphore);
}

static inline int DestroyPlatformSemaphore(
    PlatformSemaphore *platformSemaphore) {
  return sem_destroy(platformSemaphore);
}

typedef struct __PlatformSemaphore {
  long int c;
  pthread_mutex_t m;
  pthread_cond_t cv;
} PlatformSemaphore;

static inline int CreatePlatformSemaphore(PlatformSemaphore *platformSemaphore,
                                          long int c) {
  int ret = 0;
  ret |= pthread_mutex_init(&(platformSemaphore->m), NULL);
  ret |= pthread_cond_init(&(platformSemaphore->cv), NULL);
  platformSemaphore->c = c;
  return ret;
}

static inline int PlatformSemaphoreWait(PlatformSemaphore *platformSemaphore) {
  int ret = 0;
  ret |= pthread_mutex_lock(&(platformSemaphore->c));
  platformSemaphore->c--;
  while (platformSemaphore->c < 0) {
    ret |= pthread_cond_wait(&(platformSemaphore->cv), &(platformSemaphore->c));
  }
  ret |= pthread_mutex_unlock(&(platformSemaphore->c));
  return ret;
}

static inline int PlatformSemaphoreSignal(
    PlatformSemaphore *platformSemaphore) {
  int ret = 0;
  ret |= pthread_mutex_lock(&(platformSemaphore->c));
  platformSemaphore->c++;
  while (platformSemaphore->c <= 0) {
    ret |= pthread_cond_signal(&(platformSemaphore->cv));
  }
  ret |= pthread_mutex_unlock(&(platformSemaphore->c));
  return ret;
}

static inline int DestroyPlatformSemaphore(
    PlatformSemaphore *platformSemaphore) {
  int ret = 0;
  ret |= pthread_mutex_destroy(&(platformSemaphore->m));
  ret |= pthread_cond_destroy(&(platformSemaphore->cv));
  return ret;
}
