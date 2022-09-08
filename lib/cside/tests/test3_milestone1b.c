/**
 * Test 3: Milestone 1b. In this test, we create several types of local tests
 * 
 * The types of local tests we create are:
 * * Priority tasks: These tasks must complete as soon as possible
 * * Primary tasks: These tasks spawn other tasks
 * * Secondary tasks: These tasks run and then terminate
 * 
 * For this test, we will be testing collatz conjecture
 * 
 * In order to show intermediate print statements, call function with any argument
 */
#include "tests.h"
#ifdef TEST_3

#include "../tboard.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>

#define ISSUE_PRIORITY_TASKS 1
#define MAX_TIME_BETWEEN_PRIORITY 5

bool print_priority = false;
bool primary_task_complete = false;

long num_priority = 0;
long cpu_priority = 0;
int max_task_reached = 0;

int completion_count = 0, task_count = 0;

long test_time, kill_time;
pthread_t priority_gen;

void priority_task(context_t ctx);
void secondary_task(context_t ctx);
void primary_task(context_t ctx);

void *priority_task_gen(void *args);

int main(int argc, char **argv)
{
    (void)argv;
    if (argc > 1)
        print_priority = true;
    
    // init test
    test_time = clock();
    init_tests();

    // create primary task
    task_create(tboard, TBOARD_FUNC(primary_task), PRIMARY_EXEC, NULL, 0);

    // destroy tests
    destroy_tests();
    test_time = clock() - test_time;

    // print statistics
    printf("\n=================== TEST STATISTICS ================\n");
    printf("\t%d/%d sub tasks completed.\n", completion_count, NUM_TASKS);
    printf("\t%ld priority tasks were issued, with mean completion time of %f CPU cycles.\n", num_priority, (double)cpu_priority/num_priority);
    printf("\tMax task count reached %d times.\n",max_task_reached);
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n",test_time, kill_time);
    
    tboard_exit();
    return 0;

}

void init_tests()
{
    // create tboard
    tboard = tboard_create(SECONDARY_EXECUTORS);
    pthread_mutex_init(&count_mutex, NULL);

    tboard_start(tboard); // start tboard

    // create completion check and priority task generating threads
    pthread_create(&chk_complete, NULL, check_completion, tboard);
    pthread_create(&priority_gen, NULL, priority_task_gen, tboard);

    printf("Taskboard created, all threads initialized.\n");
}

void destroy_tests()
{
    tboard_destroy(tboard);
    pthread_join(chk_complete, NULL);
    pthread_join(priority_gen, NULL);
    pthread_mutex_destroy(&count_mutex);
}

/////////// Thread Functions /////////

void *check_completion(void *args)
{
    tboard_t *t = (tboard_t *)args;
    while (true) {
        if (primary_task_complete && completion_count >= task_count) {
            pthread_mutex_lock(&(t->tmutex));
            kill_time = clock();
            pthread_cancel(priority_gen);
            tboard_kill(t);
            kill_time = clock() - kill_time;
            printf("=================== TASK STATISTICS ================\n");
            history_print_records(t, stdout);
            pthread_mutex_unlock(&(t->tmutex));
            break;
        } else {
            fsleep(0.01);
        }
    }
    return NULL;
}

void *priority_task_gen(void *args)
{
    tboard_t *t = (tboard_t *)args;
    if (ISSUE_PRIORITY_TASKS == 0)
        return NULL;
    while (true) {
        fsleep(MAX_TIME_BETWEEN_PRIORITY);
        // alloc argument, which is when priority task was issued
        long *cput = calloc(1, sizeof(long));
        *cput = clock();
        // issue task
        bool res = task_create(t, TBOARD_FUNC(priority_task), PRIORITY_EXEC, cput, sizeof(long));
        if (!res) { // cant create task as max task reached, log incident
            free(cput);
            tboard_log("priority_task_gen: Unable to create priority task %d as max concurrent tasks has been reached.\n", num_priority);
        }
    }
    return NULL;
}

///////// Task Functions /////////

void priority_task(context_t ctx)
{
    (void)ctx;
    // get issue time
    long cpu_time = *((long *)(task_get_args()));
    int i = num_priority;
    if(print_priority) tboard_log("priority %d: Started at CPU time %ld.\n", i, cpu_time);
    // yield a couple of times
    task_yield();
    task_yield();
    // priority task technically finished here, we log execution statistics to print

    // record execution times
    cpu_time = clock() - cpu_time;
    // increment relevant information about priority task execution and log to stdout
    pthread_mutex_lock(&count_mutex);
    num_priority++;
    cpu_priority += cpu_time;
    pthread_mutex_unlock(&count_mutex);
    if(print_priority) tboard_log("priority %d: Finished after CPU time %ld.\n", i, cpu_time);
}

void secondary_task(context_t ctx)
{
    (void)ctx;
    // do collatz iteration
    long x = ((intptr_t)task_get_args());
    if (x <= 0)
        return increment_count(&completion_count);
    
    while (x > 1) {
        if (x % 2 == 0) x /= 2;
        else            x = 3*x + 1;
        task_yield();
    }
    increment_count(&completion_count);
}

void primary_task(context_t ctx)
{
    (void)ctx;

    for (long i=0; i<NUM_TASKS; i++) { // create NUM_TASKS amount of secondary tasks
        int attempts = 0;
        long n = i;
        while(false == task_create(tboard, TBOARD_FUNC(secondary_task), SECONDARY_EXEC, (void *)(intptr_t)n, 0)) {
            if (attempts > MAX_TASK_ATTEMPT) {
                tboard_log("primary: Was unable to create the same task after 30 attempts. Ending at %d tasks created.\n",i);
                primary_task_complete = true;

                return;
            }
            attempts++;
            max_task_reached++;
            
            fsleep(0.0003); // sleep for a bit so other tasks can run. We can do this as
                            // we have multiple executors
            task_yield();
        }
        task_count++;
        task_yield();
    }
    primary_task_complete = true;
}


#endif