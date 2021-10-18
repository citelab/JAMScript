#include "mqtt_manager.h"
#include "baseexecutor.h"
#include <unistd.h>

#define NUM_TASKS 50000
static int THREAD_COUNT = 1;
#define STACK_SIZE 4096 * 16
// #define RUN_SINGLE_CONTROLLER 1
static SchedulerManager chris;
static struct timespec tss, tsp, tsc, tse;
static uint32_t isFirst, isLast = 0, numError = 0, numWrongAns = 0, seq = 0, seqPost, seqAck;
static int numOfCtlr = 1;

static void PostMeasure(void *a) {
    uint32_t lst = __atomic_fetch_add(&seqPost, 1, __ATOMIC_ACQ_REL);
    if (lst == (NUM_TASKS - 1)) {
        Maintenant(&tsp);
        struct timespec ts = timespec_sub(tsp, tss);
        printf("time elapsed for post %d-- %lld.%.9ld\n", NUM_TASKS, (long long)ts.tv_sec, ts.tv_nsec);
    }
}

static void AckMeasure(void *a) {
    uint32_t lst = __atomic_fetch_add(&seqAck, 1, __ATOMIC_ACQ_REL);
    if (lst == (NUM_TASKS - 1)) {
        Maintenant(&tsc);
        struct timespec ts = timespec_sub(tsc, tss);
        printf("time elapsed for ack %d-- %lld.%.9ld\n", NUM_TASKS, (long long)ts.tv_sec, ts.tv_nsec);
    }
}

static void Connect(void) {
    TaskCommonHeader *ctask;
    cbor_item_t *res = NULL;
    uint64_t num;
    BeginTask();
    GetActiveTask(&ctask);
    GetTaskData(&num, ctask);
    if (__atomic_load_n(&isFirst, __ATOMIC_ACQUIRE) == 0) {
        if (__atomic_exchange_n(&isFirst, 1, __ATOMIC_ACQ_REL) == 0) {
            Maintenant(&tss);
        }
    }
    int port = 1883;
    char ctlrstr[] = "00000000000000000000000000000000";
    if (numOfCtlr > 1) {
        uint32_t ctlrseq = __atomic_fetch_add(&seq, 1, __ATOMIC_ACQ_REL);
        int offset = (ctlrseq % numOfCtlr);
        ctlrstr[31] += (offset + 2);
        port = 1883 + (int)offset;
    } else {
        ctlrstr[31] = '2';
    }
    CallControllerFunction("Square", cbor_move(cbor_build_uint64(num)), "127.0.0.1", port, ctlrstr, &res, PostMeasure, NULL, AckMeasure, NULL);
    if (res == NULL) {
        //printf("error res \n");
        __atomic_fetch_add(&numError, 1, __ATOMIC_ACQ_REL);
    } else {
        //printf("SUCCESSSSSSSSSSS\n");
        if (cbor_get_uint64(res) != (num * num)) {
            //printf("wrong result \n");
            __atomic_fetch_add(&numWrongAns, 1, __ATOMIC_ACQ_REL);
        }
        cbor_decref(&res);
    }
    uint32_t lst = __atomic_fetch_add(&isLast, 1, __ATOMIC_ACQ_REL);
    if (lst == (NUM_TASKS - 1)) {
        Maintenant(&tse);
        EndAllExecutors(&chris);
        struct timespec ts = timespec_sub(tse, tss);
        printf("time elapsed for %d-- %lld.%.9ld, #wrongans = %u, #errorres = %u\n", NUM_TASKS, (long long)ts.tv_sec, ts.tv_nsec, numWrongAns, numError);
    } else {
        //printf("%u\n", lst);
    }
    FinishTask();
}

DeclBatchTaskArray(static, tasks, STACK_SIZE, NUM_TASKS);
#define MAX(_a, _b) ((_a) > (_b)) ? (_a) : (_b)
int main(int argc, char *argv[]) {
    if (argc > 1) {
        numOfCtlr = atoi(argv[1]);
    }
    if (argc > 2) {
        THREAD_COUNT = atoi(argv[2]);
    }
    InitCallEnv("00000000000000000000000000000001");
    pthread_t statsPrinter;
    CreateSchedulerManager(&chris);
    for (int i = 0; i < THREAD_COUNT; i++) {
        AddExecutor(&chris, NULL, NULL);
    }
    AddTimer(&chris, MAX(THREAD_COUNT / 2, 1), (struct timespec){0, 5000});
    pthread_create(&statsPrinter, NULL, InstallStatsPrinter, &chris);
    for (uint64_t i = 0; i < NUM_TASKS; i++) {
        CreateBatchTask(&tasks[i], CreateContext, STACK_SIZE, Connect);
        SetTaskData(&tasks[i], i);
        FixTaskToItsCore(&tasks[i]);
        EnableTaskOnExecutorWithMinimumNumberOfTask(&tasks[i], &chris);
    }
    BeginAllExecutors(&chris);
    WaitAndClearSchedulerManager(&chris);
    pthread_join(statsPrinter, NULL);
    return 0;
}