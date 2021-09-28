#pragma once
#include "timeout.h"
#include "spinlock.h"

typedef struct __Timer {
  struct timeouts timingWheel;
  __ContextSpinMutexInternal mtx;
} Timer;
