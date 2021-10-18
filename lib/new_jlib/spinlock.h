#pragma once
typedef volatile unsigned long int DEFAULT_SPINLOCK_TYPE;

typedef DEFAULT_SPINLOCK_TYPE __ContextSpinMutexInternal;

static inline int __CreateContextSpinMutexInternal(
    __ContextSpinMutexInternal* m) {
  __ContextSpinMutexInternal* lk = m;
  __atomic_store_n(lk, 0, __ATOMIC_RELEASE);
  return 0;
}
#define MAX(a, b) (a < b) ? b : a

static inline int __ContextSpinMutexInternalLock(
    __ContextSpinMutexInternal* lpMutex) {
  __ContextSpinMutexInternal* mtx = lpMutex;
  unsigned long wait = 1;
  while (__atomic_exchange_n(mtx, 1, __ATOMIC_ACQ_REL)) {
    for (unsigned long i = 0; i < wait; i++) {
      __builtin_ia32_pause();
    }
    while (__atomic_load_n(mtx, __ATOMIC_RELAXED)) {
      wait = MAX(wait * 2, 1 << 10);
      for (unsigned long i = 0; i < wait; i++) {
        __builtin_ia32_pause();
      }
    }
  }
  return 0;
}

static inline int __ContextSpinMutexInternalTryLock(
    __ContextSpinMutexInternal* lpMutex) {
  __ContextSpinMutexInternal* mtx = lpMutex;
  return __atomic_exchange_n(mtx, 1, __ATOMIC_ACQ_REL);
}

static inline int __ContextSpinMutexInternalUnlock(
    __ContextSpinMutexInternal* lpMutex) {
  __ContextSpinMutexInternal* mtx = (__ContextSpinMutexInternal*)lpMutex;
  __atomic_store_n(mtx, 0, __ATOMIC_RELEASE);
  return 0;
}

static inline int __DestroyContextSpinMutexInternal(
    __ContextSpinMutexInternal* m) {
  return 0;
}
