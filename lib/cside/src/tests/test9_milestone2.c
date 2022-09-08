/**
 * Test 9: Milestone 2, with the real MQTT adapter
 */

#include "tests.h"
#ifdef TEST_9

#include "../tboard.h"
#include "../command.h"
#include "../mqtt_adapter.h"
#include "../core.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>
#include <unistd.h>

long kill_time, test_time;
int messages_sent = 0;

corestate_t *cs;

pthread_t idler;

void *idler_func() {
    sleep(500);
    tboard_kill(cs->tboard);
}

int main()
{
    test_time = clock();
    init_tests();

    pthread_create(&idler, NULL, idler_func, NULL);
    pthread_join(idler, NULL);

    test_time = clock() - test_time;

    // destroy tboard
    tboard_destroy(cs->tboard);
    printf("\n=================== TEST STATISTICS ================\n");
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n", test_time, kill_time);

    tboard_exit();
}

void remote_task_gen(context_t args) {
    remote_task_t rtask = {0};
    strcpy(rtask.command, "print");
    char *pmessage = calloc(20, sizeof(char));
    strcpy(pmessage, "Hello Worldxxx!");
//    bool res = remote_async_task_create("print", pmessage, strlen(pmessage));
    //if (!res) 
      //  tboard_err("Could not create remote task 'print Hello World!'\n");
    free(pmessage);
}

void MQTT_Spawned_Task2(context_t ctx)
{
    (void)ctx;
    int n = 1;
    printf("\tMQTT Spawned Task %d started.\n", n);
    task_yield();
    printf("\tMQTT Spawned Task %d ended.\n", n);
//    task_create(tboard, TBOARD_FUNC(remote_task_gen, "", true), NULL, 0);
}

void MQTT_Spawn_Task2(context_t ctx)
{
    (void)ctx;
    tboard_t *t = (tboard_t *)(task_get_args());

    printf("MQTT Was instructed to spawn a task.\n");

//    task_create(tboard, TBOARD_FUNC(MQTT_Spawned_Task2, "", false), NULL, 0);
    printf("Done task create.. \n");
    task_yield();
}

void funcA(char *name, double x, char *q, int k, char *y) 
{
    printf("func A -- name =  %s\n", name);
    printf("func A -- x =  %f\n", x);
    printf("func A -- q =  %s\n", q);    
    printf("func A -- k =  %d\n", k);        
    printf("func A -- y =  %s\n", y);            
    task_yield();
}

void callfuncA(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    funcA(t[0].val.sval, t[1].val.dval, t[2].val.sval, t[3].val.ival, t[4].val.sval);
 //   command_arg_inner_free(t);
}



void test_func2(char *name, int k, double q) 
{
    printf("This is from Test Func2 name =  %s\n", name);
    printf("This is local Test Func2 k =  %d\n", k);
    printf("This is local Test Func2 q =  %f\n", q);
    task_yield();
}

void calltest_func2(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    test_func2(t[0].val.sval, t[1].val.ival, t[2].val.dval);
 //   command_arg_inner_free(t);
}


void init_tests()
{
    command_t *cmd;
    cs = core_init(1883, 1, 0);
    char *topics[] = {"/info"};
    core_create_server(cs, EDGE_LEVEL, "localhost", 1883, topics, 1);
    core_create_server(cs, EDGE_LEVEL, "localhost", 2883, topics, 1);
    core_create_server(cs, CLOUD_LEVEL, "localhost", 3883, topics, 1);

    tboard_register_func(cs->tboard, TBOARD_FUNC(calltest_func2, "sid", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(callfuncA, "sdsis", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(MQTT_Spawned_Task2, "", false));
    tboard_register_func(cs->tboard, TBOARD_FUNC(MQTT_Spawn_Task2, "", false));

    tboard_start(cs->tboard);

    printf("Taskboard created, all threads initialized.\n");
}


void *kill_tboard(void *args)
{
    tboard_t *t = (tboard_t *)args;
    // kill tboard after certain amount of time has elapsed
    //fsleep(RAPID_GENERATION ? 5 : MAX_RUN_TIME);
    sleep(5000);
    exit(0);
    pthread_mutex_lock(&(t->tmutex));

    // measure time it takes to kill MQTT and tboard. Kill MQTT before so it cant issue
    // any tasks or responses to dead tboard
    kill_time = clock();
    tboard_kill(t);
    kill_time = clock() - kill_time;

    printf("=================== TASK STATISTICS ================\n");
    history_print_records(t, stdout);
    pthread_mutex_unlock(&(t->tmutex));
    return NULL;
}

void *check_completion(void *args)
{
    tboard_t *t = (tboard_t *)args;
    (void)t;
    return NULL;
}

#endif