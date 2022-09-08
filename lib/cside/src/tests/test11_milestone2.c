/**
 * Test 10: Milestone 2, with the real MQTT adapter
 */

#include "tests.h"
#ifdef TEST_11

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
pthread_t idler;
corestate_t *cs;

void idle_func() {
    sleep(1);
    printf("Kill called.. \n");
    tboard_kill(cs->tboard);
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

    test_time = clock() - test_time;
    pthread_create(&idler, NULL, idle_func, NULL);

    core_destroy(cs);
    
    pthread_join(idler, NULL);

    printf("\n=================== TEST STATISTICS ================\n");
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n", test_time, kill_time);
}

void local_test(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 1000000; i++) {
     //   printf("This is local test.. %s\n", name);
    //    printf("This is local test.. %s\n", g);
     //   printf("This is local test.. %d %s\n", i, h);
    //    task_yield();
        a = remote_sync_call(cs->tboard, "testfunc", "", 0, "ssi", "this is test 1 - hello", "world", i);
        command_arg_free(a);
        task_yield();
 //       remote_sync_call(cs->tboard, "addfloat", "", 0, "ff", 45.0, 545.03434);
//        command_arg_print(a);
    }
}


void local_test3(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 1000000; i++) {
     //   printf("This is local test.. %s\n", name);
    //    printf("This is local test.. %s\n", g);
     //   printf("This is local test.. %d %s\n", i, h);
    //    task_yield();
        a = remote_sync_call(cs->tboard, "testfunc", "", 0, "ssi", "this is test 2 - hello", "world", i);
        command_arg_free(a);
        task_yield();
 //       remote_sync_call(cs->tboard, "addfloat", "", 0, "ff", 45.0, 545.03434);
//        command_arg_print(a);
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
    command_arg_free(t);
    return NULL;
}

void *calllocal_test3(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test3(t[0].val.sval, t[1].val.ival, t[2].val.sval);
    command_arg_free(t);
    return NULL;
}

void calllocal_test(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_arg_free(t);
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

    mco_push(mco_running(), &retarg, sizeof(arg_t));
    command_arg_inner_free(t);
}

void init_tests(corestate_t *cs)
{
    tboard_register_func(cs->tboard, TBOARD_FUNC(calllocal_test, "sss", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(calllocal_test2, "sid", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(callgive_value, "s", true));

    local_async_call(cs->tboard, "calllocal_test", "mahesh", "world", "argh", "dfsdfsd");
 //   local_async_call(cs->tboard, "calllocal_test2", "mahesh", 34, 89.567);

    tboard_start(cs->tboard);
    printf("Taskboard created, all threads initialized.\n");
}


#endif