#include <assert.h>
#include <pthread.h>
#include <stdlib.h>
#include <stdio.h>
#include <time.h>

#include "baseexecutor.h"
#include "context.h"
#include "list.h"
#include "sync.h"

#define NUM_TASKS 1111111
#define THREAD_COUNT 6
#define MAX_TASKS NUM_TASKS
#define STACK_SIZE 4096
#define SKYNET_INPUT 1000000

struct SkynetArgs {
  long res, num, size, div;
  void *task;
};

static SchedulerManager chris;

static List globalFreeList;
static ContextMutex mtxGlobalFreeList;
static __thread List threadCachedFreeList;

static pthread_t executors[THREAD_COUNT];
DeclBatchTaskArray(static, tasks, STACK_SIZE, MAX_TASKS);
static DeclBatchTask(skynet, STACK_SIZE);

static inline void InitFreeLists() {
  list_init(&globalFreeList);
  CreateContextMutex(&mtxGlobalFreeList);
  for (int i = 0; i < MAX_TASKS; i++) {
    list_insert_back(&globalFreeList, (ListNode *)(&tasks[i]));
  }
}

static inline void *AllocateTask() {
  if (list_empty(&threadCachedFreeList)) {
    ContextMutexLock(&mtxGlobalFreeList);
    ListNode *newTask = list_front(&globalFreeList);
    list_remove_front(&globalFreeList);
    ContextMutexUnlock(&mtxGlobalFreeList);
    assert(newTask);
    return newTask;
  }
  void *newTask = list_front(&threadCachedFreeList);
  list_remove_front(&threadCachedFreeList);
  return newTask;
  // return malloc(sizeof(BatchTaskHeader) + STACK_SIZE);
}

static inline void FreeTask(void *t) {
  ((ListNode *)t)->next = ((ListNode *)t)->prev = NULL;
  list_insert_front(&threadCachedFreeList, (ListNode *)t);
  //free(t);
}

static inline void SetSkynetArgs(struct SkynetArgs *arg, long num, long size,
                                 long div) {
  arg->res = 0;
  arg->num = num;
  arg->size = size;
  arg->div = div;
}
static __thread int initedThreadList = 0;

static void InitThreadLocalFreeList(void *ptr) {
  list_init(&threadCachedFreeList);
}

static void Skynet() {
  BeginTask();
  void *ctx;
  struct SkynetArgs *arg;
  GetCurrentContext(&ctx);
  GetContextData(&arg, ctx);
  if (!initedThreadList) {
    initedThreadList = 1;
  }
  if (arg->size > 1) {
    // printf("node=%ld\n", arg->size);
    struct SkynetArgs nextLevel[arg->div];
    for (long i = 0; i < arg->div; i++) {
      // printf("i=%ld\n", i);
      long nextSize = arg->size / arg->div;
      nextLevel[i].task = AllocateTask();
      SetSkynetArgs(&(nextLevel[i]), arg->num + i * nextSize, nextSize,
                    arg->div);
      CreateBatchTask(nextLevel[i].task, CreateContext, STACK_SIZE, Skynet);
      SetTaskData(nextLevel[i].task, &(nextLevel[i]));
      EnableTaskOnCurrentExecutor(nextLevel[i].task);
    }
    // CurrentTaskWaitFor((struct timespec){0, 3000});
    for (long i = 0; i < arg->div; i++) {
      if (WaitForTaskUntilFinish(nextLevel[i].task)) {
        printf("intermediate\n");
      }
      // printf("wakeup node=%ld\n", arg->size);
      arg->res += nextLevel[i].res;
      DestroyBatchTask(nextLevel[i].task);
      FreeTask(nextLevel[i].task);
    }
    // printf("node=%ld notifies\n", arg->size);
    FinishTask();
  }
  // printf("leaf\n");
  arg->res = arg->num;
  FinishTask();
}

static DeclBatchTask(skynetSub, STACK_SIZE);
static void SkynetMain() {
  BeginTask();
  printf("SkynetMain\n");
  list_init(&threadCachedFreeList);
  struct timespec tpi, tpe;
  static struct SkynetArgs skynetArgs;
  clock_gettime(CLOCK_REALTIME, &tpi);
  CreateBatchTask(skynetSub, CreateContext, STACK_SIZE, Skynet);
  SetSkynetArgs(&skynetArgs, 0, SKYNET_INPUT, 10);
  SetTaskData(skynetSub, &skynetArgs);
  EnableTask(skynetSub);
  if (WaitForTaskUntilFinish(skynetSub)) {
    printf("end\n");
  }
  clock_gettime(CLOCK_REALTIME, &tpe);
  printf("result = %ld, elapsed = %ld sec, %ld nsec\n", skynetArgs.res,
         timespec_sub(tpe, tpi).tv_sec, timespec_sub(tpe, tpi).tv_nsec);
  EndAllExecutors(&chris);
  FinishTask();
}

// gcc baseexecutor.c context.c list.c skynet2.c sync.c timediff.c timeout.c funcreg.c mqtt_manager.c mqtt.c rtsched.c task_allocator.c mqtt_pal.c pqueue.c -lpthread -D _GNU_SOURCE -ggdb -mcmodel=large -O3 -lcbor
int main() {
  for (int i = 0; i < 10000; i++) {
    printf("iteration: %d\n", i);
    InitFreeLists();
    CreateSchedulerManager(&chris);
    for (int i = 0; i < THREAD_COUNT; i++) {
      AddExecutor(&chris, InitThreadLocalFreeList, NULL);
    }
    AddTimer(&chris, THREAD_COUNT / 4, (struct timespec){0, 5000});
    CreateBatchTask(skynet, CreateContext, STACK_SIZE, SkynetMain);
    EnableTaskOnExecutorWithMinimumNumberOfTask(skynet, &chris);
    BeginAllExecutors(&chris);
    WaitAndClearSchedulerManager(&chris);
  }
  return 0;
}
