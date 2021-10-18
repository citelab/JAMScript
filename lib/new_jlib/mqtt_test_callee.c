#include "mqtt_manager.h"
#include "baseexecutor.h"
#include "funcreg.h"

#define NUM_TASKS 10
static int THREAD_COUNT = 2;
#define STACK_SIZE 4096

static SchedulerManager chris;
static struct timespec tss, tse;
static uint32_t isFirst, isLast = 0;
static char selfctlr[] = "00000000000000000000000000000000";
static int port = 1883;
static void Square(void) {
    TaskCommonHeader *ctask;
    RemoteExecutionAttribute *argAttr;
    GetActiveTask(&ctask);
    GetTaskData(&argAttr, ctask);
    uint64_t num = cbor_get_uint64(argAttr->args);
    argAttr->result = cbor_build_uint64(num * num);
    //printf("%llu^2 = %llu\n", num, num * num);
}

static void Connect(void) {
    BeginTask();
    TaskCommonHeader *task;
    printf("start to listen\n");
    CreateMQTTTaskLaunchSubscriptionTask(&task, "127.0.0.1", port, selfctlr);
    EnableTaskOnCurrentExecutor(task);
    WaitForTaskUntilFinish(task);
    FinishTask();
}

DeclBatchTaskArray(static, tasks, STACK_SIZE, NUM_TASKS);
#define MAX(_a, _b) ((_a) > (_b)) ? (_a) : (_b)
// gcc baseexecutor.c context.c funcreg.c list.c mqtt_manager.c mqtt_pal.c mqtt.c pqueue.c rtsched.c sync.c task_allocator.c timeout.c timer.c mqtt_test_callee.c -o mqtt_test_callee -lpthread -lcbor
int main(int argc, char *argv[]) {
    char numDeCtlr = 2;
    if (argc > 1) {
        numDeCtlr = atoi(argv[1]) & 0xFF;
        port += (numDeCtlr - 2);
    }
    if (argc > 2) {
        THREAD_COUNT = atoi(argv[2]);
    }
    selfctlr[31] += numDeCtlr;
    InitCallEnv(selfctlr);
    RegisterFunctionByName(Square, "Square", 4096, (struct timespec){0, 3000});
    CreateSchedulerManager(&chris);
    pthread_t statsPrinter;
    pthread_create(&statsPrinter, NULL, InstallStatsPrinter, &chris);
    for (int i = 0; i < THREAD_COUNT; i++) {
        AddExecutor(&chris, NULL, NULL);
    }
    AddTimer(&chris, MAX(THREAD_COUNT / 2, 1), (struct timespec){0, 10000});
    CreateBatchTask(&tasks[0], CreateContext, STACK_SIZE, Connect);
    EnableTaskOnExecutorWithMinimumNumberOfTask(&tasks[0], &chris);
    BeginAllExecutors(&chris);
    WaitAndClearSchedulerManager(&chris);
    pthread_join(statsPrinter, NULL);
    struct timespec ts = timespec_sub(tse, tss);
    printf("time elapsed for %d: %lld.%.9ld", NUM_TASKS, (long long)ts.tv_sec, ts.tv_nsec);
    return 0;
}