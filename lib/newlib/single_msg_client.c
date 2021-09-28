#include "mqtt_manager.h"
#include "baseexecutor.h"
#include <unistd.h>

#define NUM_TASKS 3
#define THREAD_COUNT 4
#define STACK_SIZE 4096
#define MAX(_a, _b) ((_a) > (_b)) ? (_a) : (_b)

static SchedulerManager chris;
static int num = 0;
DeclBatchTaskArray(static, tasks, STACK_SIZE, NUM_TASKS);

static void Connect(void) {
    BeginTask();
    struct timespec ts, te;
    cbor_item_t *res = NULL;
    uint64_t c2jdelta, j2cdelta, jtime;
    Maintenant(&ts);
    CallControllerFunction("TimeReturn", cbor_move(cbor_build_uint64(c2jdelta)), "127.0.0.1", 1883, "00000000000000000000000000000002", &res, NULL, NULL, NULL, NULL);
    Maintenant(&te);
    if (res != NULL) {
        jtime = cbor_get_uint64(res);
        c2jdelta = jtime - ConvertTimeSpecToNanoseconds(ts);
        j2cdelta = ConvertTimeSpecToNanoseconds(te) - jtime;
        printf("C->J delay: %llu ns, J->C delay: %llu ns, time@J: %llu ns\n", c2jdelta, j2cdelta, jtime);
    } else {
        __builtin_trap();
    }
    if (num++ == (NUM_TASKS - 1)) {
        EndAllExecutors(&chris);
    }
    //
    FinishTask();
}

int main() {
    InitCallEnv("00000000000000000000000000000001");
    CreateSchedulerManager(&chris);
    for (int i = 0; i < THREAD_COUNT; i++) {
        AddExecutor(&chris, NULL, NULL);
    }
    AddTimer(&chris, MAX(THREAD_COUNT / 2, 1), (struct timespec){0, 5000});
    for (int i = 0; i < NUM_TASKS; i++) {
        CreateBatchTask(&tasks[i], CreateContext, STACK_SIZE, Connect);
        FixTaskToItsCore(&tasks[i]);
        EnableTaskOnExecutorWithMinimumNumberOfTask(&tasks[i], &chris);
    }
    BeginAllExecutors(&chris);
    WaitAndClearSchedulerManager(&chris);
    return 0;
}