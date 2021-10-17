#include "context.h"
#include "config.h"
#include "platformsync.h"
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <pthread.h>

#include "baseexecutor.h"
#include "timediff.h"

#define asCtxPtr(cn) ((JAMScriptUserContext *)cn)

typedef struct __JAMScriptUserContext {
  JAMC_USER_CONTEXT_MEMBERS
  unsigned char stack[];
} JAMScriptUserContext;

enum CopyStackError {
  COPY_STACK_SUCCESS = 0,
  COPY_STACK_ERR_NOT_COPYSTACK = 1,
  COPY_STACK_ERR_SHARED_STACK_OVERFLOW = 2,
  COPY_STACK_ERR_COPY_STACK_OVERFLOW = 3,
  COPY_STACK_ERR_SHARED_STACK_UNDERFLOW = 4
};

static __thread PreemptionHandlerType preemptionHandler = NULL;
static __thread JAMScriptUserContext* currentContext;

static volatile __thread sig_atomic_t hasPreemption = 0;
static volatile __thread sig_atomic_t isContextSwitching = 0;

static __thread unsigned long int sharedStackBeginPtr;
static __thread unsigned long int sharedStackEndPtr;
static __thread unsigned char defaultStackBuffer[DEFAULT_SHARED_STACK_SIZE]
    __attribute__((aligned(16)));

int __attribute__((noinline, visibility("internal")))
ContextSwitchRawInner(void* src, void* dest);
#ifdef __amd64__
asm(".text                         \n\t"
#ifdef __APPLE__
    ".globl _ContextSwitchRawInner \n\t"
    "_ContextSwitchRawInner:       \n\t"
#else
    ".globl ContextSwitchRawInner  \n\t"
    "ContextSwitchRawInner:        \n\t"
#endif
    "movq       (%rsp), %r8        \n\t"
    "leaq       0x8(%rsp), %rcx    \n\t"
    "movq       %r12, 0x0(%rdi)    \n\t"
    "movq       %r13, 0x8(%rdi)    \n\t"
    "movq       %r14, 0x10(%rdi)   \n\t"
    "movq       %r15, 0x18(%rdi)   \n\t"
    "movq       %r8,  0x20(%rdi)   \n\t"
    "movq       %rcx, 0x28(%rdi)   \n\t"
    "movq       %rbx, 0x30(%rdi)   \n\t"
    "movq       %rbp, 0x38(%rdi)   \n\t"
    "fnstcw     0x40(%rdi)         \n\t"
    "stmxcsr    0x48(%rdi)         \n\t"
    "movq       0x0(%rsi),  %r12   \n\t"
    "movq       0x8(%rsi),  %r13   \n\t"
    "movq       0x10(%rsi), %r14   \n\t"
    "movq       0x18(%rsi), %r15   \n\t"
    "movq       0x20(%rsi), %r8    \n\t"
    "movq       0x28(%rsi), %rcx   \n\t"
    "movq       0x30(%rsi), %rbx   \n\t"
    "movq       0x38(%rsi), %rbp   \n\t"
    "fldcw      0x40(%rsi)         \n\t"
    "ldmxcsr    0x48(%rsi)         \n\t"
    "movq       %rcx, %rsp         \n\t"
    "movq       $0, %rax           \n\t"
    "jmpq       *%r8               \n\t");
#elif defined(__aarch64__)
asm(".text                      \n\t"
#ifdef __APPLE__
    ".globl _ContextSwitchRawInner \n\t"
    "_ContextSwitchRawInner:       \n\t"
#else
    ".globl ContextSwitchRawInner  \n\t"
    "ContextSwitchRawInner:        \n\t"
#endif
    "stp x16, x17, [x0]         \n\t"
    "stp x18, x19, [x0, #16]    \n\t"
    "stp x20, x21, [x0, #32]    \n\t"
    "stp x22, x23, [x0, #48]    \n\t"
    "stp x24, x25, [x0, #64]    \n\t"
    "stp x26, x27, [x0, #80]    \n\t"
    "stp x28, fp,  [x0, #96]    \n\t"
    "mov x3,  sp                \n\t"
    "stp lr,  x3   [x0, #112]   \n\t"
    "stp d8,  d9,  [x0, #128]   \n\t"
    "stp d10, d11, [x0, #144]   \n\t"
    "stp d12, d13, [x0, #160]   \n\t"
    "stp d14, d15, [x0, #176]   \n\t"
    "ldp x16, x17, [x1]         \n\t"
    "ldp x18, x19, [x1, #16]    \n\t"
    "ldp x20, x21, [x1, #32]    \n\t"
    "ldp x22, x23, [x1, #48]    \n\t"
    "ldp x24, x25, [x1, #64]    \n\t"
    "ldp x26, x27, [x1, #80]    \n\t"
    "ldp x28, fp,  [x1, #96]    \n\t"
    "ldr lr,  x3   [x1, #112]   \n\t"
    "mov sp,  x3                \n\t"
    "ldp d8,  d9,  [x1, #128]   \n\t"
    "ldp d10, d11, [x1, #144]   \n\t"
    "ldp d12, d13, [x1, #160]   \n\t"
    "ldp d14, d15, [x1, #176]   \n\t"
    "ret                        \n\t");
#else
#error "platform not supported"
#endif
static
__attribute__((always_inline)) inline
int ContextSwitchCopyStackPart2(void* src, void* dest) {
  if (asCtxPtr(dest)->isCopyStackContext) {
    memcpy((void*)(sharedStackBeginPtr - asCtxPtr(dest)->usedStackSize),
           asCtxPtr(dest)->stack, asCtxPtr(dest)->usedStackSize);
  }
  if (likely(src != dest)) {
    return ContextSwitchRawInner(src, dest);
  }
  return 0;
}

static 
__attribute__((always_inline)) inline 
int ContextSwitchCopyStack(void* src, void* dest) {
    unsigned long int topOfStack;
#ifdef __x86_64__
    asm("movq %%rsp, %0" : "=rm"(topOfStack));
#elif defined(__aarch64__)
    asm("mov %[tosp], sp" : [ tosp ] "=r"(topOfStack));
#else
#error "not supported"
#endif
  
  if (asCtxPtr(src)->isCopyStackContext) {
    if (likely(topOfStack >= sharedStackEndPtr)) {
      asCtxPtr(src)->usedStackSize = sharedStackBeginPtr - (unsigned long int)(&topOfStack);
      if (likely(asCtxPtr(src)->usedStackSize <= asCtxPtr(src)->stackSize)) {
        memcpy(asCtxPtr(src)->stack, (void*)(&topOfStack),
               asCtxPtr(src)->usedStackSize);
        return ContextSwitchCopyStackPart2(src, dest);
      }
      __builtin_trap();
      return COPY_STACK_ERR_COPY_STACK_OVERFLOW;
    }
    __builtin_trap();
    return COPY_STACK_ERR_SHARED_STACK_OVERFLOW;
  }
  /*if (unlikely(topOfStack < asCtxPtr(src)->stack)) {
    printf("OVERFLOW de STACK!!!, tos = %p, allocated top = %p\n", topOfStack, asCtxPtr(src)->stack);
    return COPY_STACK_ERR_SHARED_STACK_OVERFLOW;
  }*/
  return ContextSwitchCopyStackPart2(src, dest);
}

static inline int BeginContextInternal() {
  if (unlikely(hasPreemption)) {
    sigset_t set;
    struct timespec ts, te;
    hasPreemption = 0;
    clock_gettime(CLOCK_REALTIME, &ts);
    sigemptyset(&set);
    sigaddset(&set, JAMC_PREEMPT_SIGNAL);
    pthread_sigmask(SIG_UNBLOCK, &set, NULL);
    clock_gettime(CLOCK_REALTIME, &te);
    printf("cost of enable signal %ld ns\n", timespec_sub(te, ts).tv_nsec);
  }
  isContextSwitching = 0;
  return 0;
}

static
__attribute__((always_inline)) inline
int ContextSwitchInner(void* src, void* dest) {
  int res;
  isContextSwitching = 1;
  currentContext = asCtxPtr(dest);
  if (likely(!(res = ContextSwitchCopyStack(src, dest)))) {
    jamCall(BeginContextInternal(), 1);
  }
  return res;
}

int ContextSwitch(void* src, void* dest) {
  return ContextSwitchInner(src, dest);
}

int ContextSwitchTo(void* dest) {
  return ContextSwitchInner(currentContext, dest);
}

int ContextSwitchTo2(void *dest) {
  int res;
  void *prevContext;
  isContextSwitching = 1;
  prevContext = currentContext;
  currentContext = asCtxPtr(dest);
  return ContextSwitchCopyStack(prevContext, currentContext);
}

int CopyStackInitByDefault() {
  return CopyStackInitWith(defaultStackBuffer, DEFAULT_SHARED_STACK_SIZE);
}

void CoroWarn() {
  perror("WARNING:: Swap to Somewhere Dangerous!!!\n");
  __builtin_trap();
}

int CopyStackInitWith(void* stackPointer, unsigned long int stackSize) {
  if (stackSize >= (sizeof(void*) << 1)) {
    sharedStackEndPtr = (unsigned long int)stackPointer;
    sharedStackBeginPtr =
        (unsigned long int)(stackPointer) + stackSize;
    sharedStackBeginPtr = ((sharedStackBeginPtr >> 4) << 4) - sizeof(void*);
    *((void**)(sharedStackBeginPtr)) = (void*)(&CoroWarn);
    printf("sharedStackEndPtr=%p, sharedStackBeginPtr=%p\n", sharedStackEndPtr, sharedStackBeginPtr);
    return COPY_STACK_SUCCESS;
  }
  return COPY_STACK_ERR_SHARED_STACK_UNDERFLOW;
}

int CreateCopyStackContext(void* ucp, unsigned long int stackSize,
                           void (*func)(void)) {
  asCtxPtr(ucp)->registers[JAMC_FUNCT_POINTER_REG] = (unsigned long int)func;
  asCtxPtr(ucp)->registers[JAMC_STACK_POINTER_REG] = sharedStackBeginPtr;
  asCtxPtr(ucp)->stackSize = stackSize;
  asCtxPtr(ucp)->usedStackSize = 0;
  asCtxPtr(ucp)->isCopyStackContext = 1;
  return 0;
}

int RefreshStackContext(void* ucp) {
  asCtxPtr(ucp)->registers[JAMC_STACK_POINTER_REG] = sharedStackBeginPtr;
  return 0;
}

static void PreemptionHandler(int signum) {
  if (signum == JAMC_PREEMPT_SIGNAL && !isContextSwitching) {
    hasPreemption = 1;
    preemptionHandler(signum);
  }
}

int MakeContextPreemptive(void* ctx) {
  asCtxPtr(ctx)->isPreemptiveStackContext = 1;
  return 0;
}

int BeginContext() { 
  return BeginContextInternal(); 
}

int EnablePreemptionWith(PreemptionHandlerType fpp) {
  preemptionHandler = fpp;
  signal(JAMC_PREEMPT_SIGNAL, PreemptionHandler);
  return 0;
} 

int PreemptThread(void *ptid) { 
  return KillPlatformThreadWith((PlatformThread*)ptid, JAMC_PREEMPT_SIGNAL); 
}

int CreateContext(void* ucp, unsigned long int stackSize, 
                  void (*func)(void)) {
  /*unsigned long int stackStart =
      (unsigned long int)(stackSize - (sizeof(void*) << 1) +
                          (unsigned long int)(asCtxPtr(ucp)->stack));
  stackStart = (stackStart >> 4) << 4;
  asCtxPtr(ucp)->registers[4] = (unsigned long int)(func);
  asCtxPtr(ucp)->registers[5] = stackStart - sizeof(void*);
  asCtxPtr(ucp)->isCopyStackContext = 0;
  *((void**)(asCtxPtr(ucp)->registers[5])) = (void*)(CoroWarn);
  asCtxPtr(ucp)->stackSize = stackSize;*/
  unsigned long int stackStart = (unsigned long int)(asCtxPtr(ucp)->stack) + stackSize;
  stackStart = ((stackStart >> 4) << 4) - sizeof(void*);
  asCtxPtr(ucp)->registers[4] = (unsigned long int)(func);
  asCtxPtr(ucp)->registers[5] = stackStart;
  *((void **)stackStart) = (void*)(&CoroWarn);
  asCtxPtr(ucp)->stackSize = stackStart - (unsigned long int)(asCtxPtr(ucp)->stack);
  asCtxPtr(ucp)->isCopyStackContext = 0;
  return 0;
}

int GetCurrentContext(void* ucpp) { 
  *((void**)ucpp) = currentContext; 
  return 0;
}

int GetContextData(void *rData, void* ucp) { 
  *((void**)rData) = asCtxPtr(ucp)->data; 
  return 0;
}

int GetCopyStackLocations(void *lpBE) {
  BaseTaskExecutor *baseExecutor = lpBE;
  baseExecutor->sharedStackBeginPtr = sharedStackBeginPtr;
  baseExecutor->sharedStackEndPtr = sharedStackEndPtr;
  return 0;
}

int SetContextData(void* ucp, void* dt) { 
  asCtxPtr(ucp)->data = dt; 
  return 0;
}

int GetIsContextSwitching() {
  return isContextSwitching;
}

int DisablePreemptionSignal() {
  isContextSwitching = 1;
  return 0;
}

int EnablePreemptionSignal(int prev) {
  isContextSwitching = prev;
  return 0;
}

int InitWith(void *lpMainContext) {
  if (!currentContext) {
    asCtxPtr(lpMainContext)->isCopyStackContext = 0;
    currentContext = lpMainContext;
    return 0;
  }
  return 1;
}
