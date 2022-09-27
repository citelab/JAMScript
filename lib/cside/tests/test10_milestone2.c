/**
 * Test 10: Milestone 2, with the real MQTT adapter
 */

#include "tests.h"
#ifdef TEST_10

#include "../tboard.h"
#include "../command.h"
#include "../core.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>
#include <unistd.h>
#include "../calls.h"

long kill_time, test_time;
int messages_sent = 0;
pthread_t idler;
corestate_t *cs;

void *idle_func() {
    sleep(500);
    return NULL;
}

int main()
{
    test_time = clock();
    cs = core_init(1883, 1, 0);
    char *topics[] = {"/info"};
 //   core_create_server(cs, DEVICE_LEVEL, "localhost", 1883, topics, 1);
    core_create_server(cs, EDGE_LEVEL, "localhost", 1883, topics, 1);
    core_create_server(cs, CLOUD_LEVEL, "localhost", 3883, topics, 1);
    init_tests(cs);    

    pthread_create(&idler, NULL, idle_func, NULL);
    pthread_join(idler, NULL);

    printf("\n=================== TEST STATISTICS ================\n");
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n", test_time, kill_time);

    tboard_exit();
}

void local_test(char *name, char *g, char *h)
{
    for (int i =0; i < 10000; i++) {
        printf("This is local test.. %s\n", name);
        printf("This is local test.. %s\n", g);
        printf("This is local test.. %d %s\n", i, h);
        task_yield();
        remote_async_call(cs->tboard, "testfunc", "", 0, "ssi", "dfdsfdsfdsf", "dfsdfdsfdsf", 4545);
    }
}

void local_test2(char *name, int k, double q)
{
    arg_t *q2;
    printf("This is local test.. %s\n", name);
    printf("This is local test.. %d\n", k);
    printf("This is local test.. %f\n", q);
    task_yield();

    for (int i = 0; i < 10; i++)
    {
        q2 = local_sync_call(cs->tboard, "callgive_value", "nagesh");
        printf("%d After . calling sync  %s\n", i, q2->val.sval);
        command_arg_free(q2);
        task_yield();
    }
}

void *calllocal_test2(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test2(t[0].val.sval, t[1].val.ival, t[2].val.dval);
    command_arg_inner_free(t);
}

void calllocal_test(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_arg_inner_free(t);
}

char *give_value(char *str)
{
    return str;
}

void callgive_value(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    arg_t retarg; // = calloc(1, sizeof(arg_t));
    retarg.type = STRING_TYPE;
    retarg.nargs = 1;

    retarg.val.sval = strdup(give_value(t->val.sval));

    printf("IN give value... retruning... %s, %s\n", t[0].val.sval, retarg.val.sval);
    mco_push(mco_running(), &retarg, sizeof(arg_t));
    command_arg_inner_free(t);
}

void init_tests(corestate_t *cs)
{

    printf("Hello 1\n");

    tboard_register_func(cs->tboard, TBOARD_FUNC(calllocal_test, "sss", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(calllocal_test2, "sid", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(callgive_value, "s", true));

    printf("Hello 2\n");
    local_async_call(cs->tboard, "calllocal_test", "mahesh", "world", "argh", "dfsdfsd");
    local_async_call(cs->tboard, "calllocal_test2", "mahesh", 34, 89.567);

    printf("Hello 21\n");

    tboard_start(cs->tboard);

    printf("Taskboard created, all threads initialized.\n");
}

void *check_completion(void *args)
{
    tboard_t *t = (tboard_t *)args;
    (void)t;
    return NULL;
}

#endif