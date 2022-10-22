/**
 * Test 4: Milestone 1b. In this test, we create several types of local tests with task board sleeping
 * 
 * The types of local tests we create are:
 * * Primary tasks: These tasks spawn other tasks
 * * Secondary tasks: These tasks run and then terminate
 * 
 * For this test, we will create a primary task that will end rapidly every ~1 second
 */

#include "tests.h"
#ifdef TEST_4

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
pthread_t gen_thread;
long kill_time, test_time;
int unfinished_tasks;


void primary_task(context_t ctx);
void secondary_task(context_t ctx);

void *gen_task_func(void *args);

int main()
{
    test_time = clock();
    init_tests();

    destroy_tests();
    test_time = clock() - test_time;

    printf("\n=================== TEST STATISTICS ================\n");
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n",test_time, kill_time);
    
    tboard_exit();
}

void init_tests()
{
    tboard = tboard_create(SECONDARY_EXECUTORS);
    pthread_mutex_init(&count_mutex, NULL);

    tboard_start(tboard);

    pthread_create(&tb_killer, NULL, kill_tboard, tboard);
    pthread_create(&gen_thread, NULL, gen_task_func, tboard);

    printf("Taskboard created, all threads initialized.\n");
}

void destroy_tests()
{
    tboard_destroy(tboard);
    pthread_join(tb_killer, NULL);
    pthread_join(gen_thread, NULL);
    pthread_mutex_destroy(&count_mutex);
}

void *kill_tboard (void *args)
{
    tboard_t *t = (tboard_t *)args;
    fsleep(MAX_RUN_TIME);
    // initiate killing task board
    pthread_mutex_lock(&(t->tmutex));
    // Kill tboard, record run time
    pthread_cancel(gen_thread);
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


void *gen_task_func(void *args)
{
    (void)args;
    // continuously generate tasks every <1 second
    while (true) {
        fsleep(1);
        task_create(tboard, TBOARD_FUNC(primary_task), PRIMARY_EXEC, NULL, 0);
    }
}

void primary_task(context_t ctx)
{
    (void)ctx;
    // spawn small tasks and terminate.
    task_create(tboard, TBOARD_FUNC(secondary_task), SECONDARY_EXEC, NULL, 0);
    return;
}

void secondary_task(context_t ctx)
{
    // we want this task to terminate rapidly
    (void)ctx;
    task_yield();
    return;
}


#endif