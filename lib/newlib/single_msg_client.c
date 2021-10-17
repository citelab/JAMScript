#include "mqtt_manager.h"
#include "baseexecutor.h"
#include <unistd.h>

#define NUM_TASKS 3
#define THREAD_COUNT 4
#define STACK_SIZE 4096 * 8
#define MAX(_a, _b) ((_a) > (_b)) ? (_a) : (_b)

static SchedulerManager chris;
static int num = 0;
static int port = 1883;
DeclBatchTaskArray(static, tasks, STACK_SIZE, NUM_TASKS);

static void ObtainedCallAck(void *a) {
    printf("callacked\n");
}

static void Sent(void *a) {
    printf("setnt\n");
}


static void Connect(void) {
    BeginTask();
    struct timespec ts, te;
    cbor_item_t *res = NULL;
    uint64_t c2jdelta, j2cdelta, jtime;
    Maintenant(&ts);
    CallControllerFunction("TimeReturn", cbor_move(cbor_build_uint64(c2jdelta)), "127.0.0.1", port, "00000000000000000000000000000002", &res, Sent, NULL, ObtainedCallAck, NULL);
    Maintenant(&te);
    if (res != NULL) {
        jtime = cbor_get_uint64(res);
        c2jdelta = jtime - ConvertTimeSpecToNanoseconds(ts);
        j2cdelta = ConvertTimeSpecToNanoseconds(te) - jtime;
        printf("C->J delay: %llu ns, J->C delay: %llu ns, time@J: %llu ns\n", c2jdelta, j2cdelta, jtime);
    } else {
        printf("bad\n");
    }
    if (num++ == (NUM_TASKS - 1)) {
        EndAllExecutors(&chris);
    }
    FinishTask();
}

int main(int argc, char *argv[]) {
    if (argc > 1) {
        port = atoi(argv[1]);
    }
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
