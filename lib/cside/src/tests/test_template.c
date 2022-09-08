/**
 * Test #: #NAME#, #DESCRIPTION#
 * 
 * The types of local tests we create are:
 * * Priority tasks: These tasks must complete as soon as possible
 * * Primary tasks: These tasks spawn other tasks
 * * Secondary tasks: These tasks run and then terminate
 * The types of remote tests we create are:
 * * #TASKNAME#: #TASKDESC#
 * 
 * #Explain Test#
 * 
 * #Explain test usage#
 */

#include "tests.h"
#ifdef TEST_N

#include "../tboard.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>

/**
 * 
 * Variable declaration
 */
pthread_t thread_f_pt;
long kill_time, test_time;
int unfinished_tasks;


void local_task(context_t ctx);
void remote_task(context_t ctx);

void *thread_func(void *args);

int main()
{
    // initialize test
    test_time = clock();
    init_tests();

    // create a local task
    task_create(tboard, TBOARD_FUNC(local_task), PRIMARY_EXEC, NULL, 0);

    // destroy tests
    destroy_tests();
    test_time = clock() - test_time;

    // print test statistics
    printf("\n=================== TEST STATISTICS ================\n");
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n",test_time, kill_time);
    
    // exit tboard
    tboard_exit();
}

void init_tests()
{
    // create taskboard
    tboard = tboard_create(SECONDARY_EXECUTORS);
    pthread_mutex_init(&count_mutex, NULL);

    // start taskboard
    tboard_start(tboard);

    // create relevant threads
    pthread_create(&chk_complete, NULL, check_completion, tboard);
    pthread_create(&tb_killer, NULL, kill_tboard, tboard);
    pthread_create(&thread_f_pt, NULL, thread_func, tboard);

    printf("Taskboard created, all threads initialized.\n");
}

void destroy_tests()
{
    // destroy task board
    tboard_destroy(tboard);
    // join threads
    pthread_join(chk_complete, NULL);
    pthread_join(tb_killer, NULL);
    pthread_join(thread_f_pt, NULL);
    // destroy incrementing mutex
    pthread_mutex_destroy(&count_mutex);
}

void *kill_tboard (void *args)
{
    tboard_t *t = (tboard_t *)args;
    // sleep for up to MAX_RUN_TIME seconds
    fsleep(MAX_RUN_TIME);
    // initiate killing task board
    pthread_mutex_lock(&(t->tmutex));
    // Kill tboard, record run time
    kill_time = clock();
    tboard_kill(t);
    kill_time = clock() - kill_time;
    // print task history
    printf("=================== TASK STATISTICS ================\n");
    history_print_records(t, stdout);
    unfinished_tasks = t->task_count;
    pthread_mutex_unlock(&(t->tmutex));
    // task board has been killed, return to terminate thread
    return NULL;
}

void *check_completion(void *args)
{
    // implemented at user's discretion.
    // if conditions are met, do similar task board killing as kill_tboard()
    tboard_t *t = (tboard_t *)args;
    (void)t;
    return NULL;
}

void *thread_func(void *args)
{
    // implemented at user's discretion
    (void)args;
    return NULL;
}

void local_task(context_t ctx)
{
    // local task to run
    (void)ctx;
    printf("Local task occured.\n");
}

void remote_task(context_t ctx)
{
    // issue a remote task
    (void)ctx;
    printf("Remote task occured.\n");
}


#endif