#include "mqtt_manager.h"
#include "baseexecutor.h"
#include <unistd.h>

#define THREAD_COUNT 4
#define STACK_SIZE 4096
#define MAX(_a, _b) ((_a) > (_b)) ? (_a) : (_b)
static int port = 1883;
static SchedulerManager chris;
DeclBatchTask(taskConnect, 4096);

static void TimeReturn(void) {
    TaskCommonHeader *ctask;
    RemoteExecutionAttribute *argAttr;
    struct timespec ts;
    GetActiveTask(&ctask);
    GetTaskData(&argAttr, ctask);
    Maintenant(&ts);
    argAttr->result = cbor_build_uint64(ConvertTimeSpecToNanoseconds(ts));
    printf("ARRRR\n");
}

static void Connect(void) {
    BeginTask();
    TaskCommonHeader *task;
    printf("start to listen\n");
    CreateMQTTTaskLaunchSubscriptionTask(&task, "127.0.0.1", port, "00000000000000000000000000000002");
    EnableTaskOnCurrentExecutor(task);
    WaitForTaskUntilFinish(task);
    FinishTask();
}

int main(int argc, char *argv[]) {
    if (argc > 1) {
        port = atoi(argv[1]);
    }
    InitCallEnv("00000000000000000000000000000002");
    RegisterFunctionByName(TimeReturn, "TimeReturn", 4096 * 2, (struct timespec){0, 5000});
    CreateSchedulerManager(&chris);
    for (int i = 0; i < THREAD_COUNT; i++) {
        AddExecutor(&chris, NULL, NULL);
    }
    AddTimer(&chris, MAX(THREAD_COUNT / 2, 1), (struct timespec){0, 5000});
    CreateBatchTask(&taskConnect, CreateContext, STACK_SIZE, Connect);
    EnableTaskOnExecutorWithMinimumNumberOfTask(taskConnect, &chris);
    BeginAllExecutors(&chris);
    WaitAndClearSchedulerManager(&chris);
    return 0;
}
