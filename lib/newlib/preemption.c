#include <pthread.h>
#include <setjmp.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include "context.h"
#include "timediff.h"
int i = 0, kClockType = CLOCK_REALTIME, kDelayTestRound = 100000;
long sleepnanosec = 500 * 1000 * 1000, sleepTime = 30000000000;
double totalSwapNsec = 0.0, totalClockGetTimeNsec = 0.0;
static struct timespec tpi, tpStartSwapin, tpStartSleep, tpExternalSuspendHint,
    tpExternalSuspendDelivered, tpExternalSuspendBackIn, tpExternalSuspendGoTo,
    tpSelfSuspendBackIn, tpSelfSuspendGoTo, tpTaskEndToMain, tpTestEndSwitch,
    tpTestBeginSwitch, tpStartClockGetTime, tpEndClockGetTime;

pthread_t mainPid, timerPid;

#define normalStackSize 8 * 4096
#define minimizedStackSize 4096
#define minimizedStackSize1 512
DeclContext(task0, normalStackSize);
DeclContext(task1, minimizedStackSize);
DeclContext(task2, minimizedStackSize1);
DeclContext(mainContext, normalStackSize);

static int fArg = 45;

int fibr(int b) {
  if (b < 2) return b;
  return fibr(b - 1) + fibr(b - 2);
}

long factStackHogger(long b) {
  long nx[4096];
  if (b == 0) return 1;
  memset(nx, 0, 4096 * 8);
  nx[rand() % 4096] = factStackHogger(b - 1);
  for (long i = 0; i < 4096; i++) {
    if (nx[i] > 0) {
      return nx[i] * b;
    }
  }
  return -1;
}

void ContextSwitchToMainHandler(int signum) {
  clock_gettime(kClockType, &tpExternalSuspendDelivered);
  PrintTimeWith(timespec_sub(tpExternalSuspendDelivered, tpi),
                "Preemption Signal Delivered\n");
  ContextSwitchTo(mainContext);
}

void f() {
  BeginContext();
  i++;
  clock_gettime(kClockType, &tpStartSleep);
  PrintTimeWith(timespec_sub(tpStartSleep, tpi), "start computing fib(%d)\n",
                fArg);
  printf("computed fibr(%d)=%d\n", fArg, fibr(fArg));
  clock_gettime(kClockType, &tpExternalSuspendBackIn);
  PrintTimeWith(timespec_sub(tpExternalSuspendBackIn, tpi),
                "back from preemption with i=%d\n", i);
  ContextSwitchTo(mainContext);
  clock_gettime(kClockType, &tpSelfSuspendBackIn);
  PrintTimeWith(timespec_sub(tpSelfSuspendBackIn, tpi),
                "back from manual suspension couldn't imagine this could ever "
                "happen, i=%d\n",
                i);
  ContextSwitchTo(mainContext);
}

void g() {
  BeginContext();
  for (int j = 0; j < kDelayTestRound; j++) {
    
    ContextSwitchTo(mainContext);
    clock_gettime(kClockType, &tpTestEndSwitch);
    clock_gettime(kClockType, &tpEndClockGetTime);
    totalSwapNsec += timespec_sub(tpTestEndSwitch, tpTestBeginSwitch).tv_nsec;
    totalClockGetTimeNsec +=
        timespec_sub(tpEndClockGetTime, tpTestEndSwitch).tv_nsec;
    i++;
    factStackHogger(12);
    
  }
  void* cdt, *ctx;
  GetCurrentContext(&ctx);
  GetContextData(&cdt, ctx);
  SetContextData(ctx, cdt + 1);
  CopyStackInitByDefault();
  ContextSwitchTo(mainContext);
}

void ContextSwitchOverheadTest() {
  i = 0;
  long int task2data;
  CopyStackInitByDefault();
  CreateCopyStackContext(task2, minimizedStackSize1, g);
  
  MakeContextPreemptive(task2);
  ContextSwitch(mainContext, task2);
  for (int j = 0; j < kDelayTestRound; j++) {
    clock_gettime(kClockType, &tpTestBeginSwitch);
    ContextSwitch(mainContext, task2);
  }
  GetContextData(&task2data, task2);
  if (task2data) {
    printf(
        "i=%d, with average switching+clock_gettime delay %lf "
        "ns, "
        "average clock_gettime delay %lf, "
        "average switching delay %lf ns\n",
        i, totalSwapNsec / kDelayTestRound,
        totalClockGetTimeNsec / kDelayTestRound,
        (totalSwapNsec - totalClockGetTimeNsec) / kDelayTestRound);
  }
}

void* TriggerThread(void* dummy) {
  struct timespec tp, tr;
  while (!clock_gettime(kClockType, &tp)) {
    tr = timespec_sub(tp, tpi);
    if (tr.tv_sec * 1000 * 1000 * 1000 + tr.tv_nsec > sleepnanosec) {
      break;
    }
  }
  clock_gettime(kClockType, &tpExternalSuspendHint);
  PrintTimeWith(timespec_sub(tpExternalSuspendHint, tpi), 
                "begin to preempt\n");
  PreemptThread(&mainPid);
  return NULL;
}

int main() {
  printf("computed fibr(%d)=%d\n", fArg, fibr(fArg));
  mainPid = pthread_self();
  CopyStackInitByDefault();
  EnablePreemptionWith(ContextSwitchToMainHandler);
  CreateContext(task0, normalStackSize, f);
  CreateCopyStackContext(task1, minimizedStackSize, f);
  MakeContextPreemptive(task0);
  MakeContextPreemptive(task1);
  clock_gettime(kClockType, &tpi);
  pthread_create(&timerPid, NULL, TriggerThread, NULL);
  clock_gettime(kClockType, &tpStartSwapin);
  PrintTimeWith(timespec_sub(tpStartSwapin, tpi),
                "swap to context from main to task 1\n");
  int ret = ContextSwitch(mainContext, task0);
  printf("%d\n", ret);
  clock_gettime(kClockType, &tpExternalSuspendGoTo);
  PrintTimeWith(timespec_sub(tpExternalSuspendGoTo, tpi),
                "back to main, try with task 2\n");
  pthread_join(timerPid, NULL);
  sleepnanosec *= 2;
  pthread_create(&timerPid, NULL, TriggerThread, NULL);
  clock_gettime(kClockType, &tpStartSwapin);
  PrintTimeWith(timespec_sub(tpStartSwapin, tpi),
                "swap to context from main to task 2\n");
  ret = ContextSwitch(mainContext, task1);
  printf("%d\n", ret);
  clock_gettime(kClockType, &tpExternalSuspendGoTo);
  PrintTimeWith(timespec_sub(tpExternalSuspendGoTo, tpi),
                "back to main, try with task 1\n");
  ret = ContextSwitch(mainContext, task0);
  printf("%d\n", ret);
  clock_gettime(kClockType, &tpSelfSuspendGoTo);
  PrintTimeWith(
      timespec_sub(tpSelfSuspendGoTo, tpi),
      "back to main, gonna resume the manually suspended context of task 1\n");
  ContextSwitch(mainContext, task1);
  clock_gettime(kClockType, &tpSelfSuspendGoTo);
  PrintTimeWith(
      timespec_sub(tpSelfSuspendGoTo, tpi),
      "back to main, gonna resume the manually suspended context of task 2\n");
  ContextSwitch(mainContext, task0);
  clock_gettime(kClockType, &tpTaskEndToMain);
  PrintTimeWith(timespec_sub(tpTaskEndToMain, tpi), "task 1 ends\n");
  ContextSwitch(mainContext, task1);
  clock_gettime(kClockType, &tpTaskEndToMain);
  PrintTimeWith(timespec_sub(tpTaskEndToMain, tpi), "task 2 ends\n");
  pthread_join(timerPid, NULL);
  printf("timer and task ends with, i=%d\n", i);
  ContextSwitchOverheadTest();
  return 0;
}