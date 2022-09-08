/**
 * Test 1: Milestone 1. In this test, we have a variety of local tasks, which are to run inside
 * pExec only. We test the following unique types of tests:
 * 
 * indefinite_task() - Runs indefinitely, continuously spawning new tasks and yielding indefinitely
 * completing_task() - Terminates after objective is complete, spawns zero or one non-blocking tasks and then terminates
 * spawning_task() - Terminates after objective is complete, spawns multiple blocking tasks, optionally prints result
 *                   and then terminates.
 * blocking_task() - Terminates after objective is complete. Spawns zero tasks. Terminates silently
 * 
 * 
 * In order to show intermediate print statements, call function with any argument
 */

#include "tests.h"
#ifdef TEST_1

#include "../tboard.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>

#define TASK_TYPE SECONDARY_EXEC

struct collatz_t {
    long x;
    long curr_x;
    long iterations;
};

int inf_spawned = 0;
int com_complete = 0, com_spawned = 0;
int spa_spawned = 0, spa_complete = 0;
int blo_complete = 0;
int unfinished_tasks = 0;
int max_task_reached = 0;

clock_t test_time, kill_time;

bool print_verbose = false;

void indefinite_task (context_t ctx);
void completing_task (context_t ctx);
void spawning_task (context_t ctx);
void blocking_task (context_t ctx); 

int main (int argc, char **argv)
{
    (void)argv;
    if (argc > 1)
        print_verbose = true;
    test_time = clock();

    init_tests();

    task_create(tboard, TBOARD_FUNC(indefinite_task), TASK_TYPE, NULL, 0);

    destroy_tests();
    test_time = clock() - test_time;

    printf("\n=================== TEST STATISTICS ================\n");
    printf("\tIndefinite task spawned %d completing tasks, %d of which completed.\n",inf_spawned, com_complete);
    printf("\tCompleting task spawned %d spawning tasks, %d of which completed.\n", com_spawned, spa_complete);
    printf("\tSpawning task spawned %d blocking tasks, %d of which completed.\n",spa_spawned, blo_complete);
    printf("There were %d unfinished task, maximum concurrent tasks reached %d times.\n",unfinished_tasks, max_task_reached);
    printf("Test took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n",test_time, kill_time);
    tboard_exit();
    return 0;
}

void init_tests()
{
    // create+start tboard
    tboard = tboard_create(SECONDARY_EXECUTORS);
    pthread_mutex_init(&count_mutex, NULL);

    tboard_start(tboard);

    pthread_create(&tb_killer, NULL, kill_tboard, tboard); // create tboard killer

    if (print_verbose)
        printf("Taskboard created, all threads initialized.\n");
}

void destroy_tests()
{
    // destroy tboard
    tboard_destroy(tboard);
    // join killer thread
    pthread_join(tb_killer, NULL);
    pthread_mutex_destroy(&count_mutex);
}

///////////////////// Thread Functions ///////////////////

void *kill_tboard (void *args)
{
    tboard_t *t = (tboard_t *)args;
    fsleep(MAX_RUN_TIME);
    // initiate killing task board
    pthread_mutex_lock(&(t->tmutex));
    kill_time = clock();
    tboard_kill(t);
    kill_time = clock() - kill_time;
    printf("=================== TASK STATISTICS ================\n");
    history_print_records(t, stdout);
    unfinished_tasks = t->task_count;
    pthread_mutex_unlock(&(t->tmutex));
    // task board has been killed, return to terminate thread
    return NULL;
}



//////////////////////// Task Functions ////////////////////////

void indefinite_task (context_t ctx)
{
    (void)ctx;
    tboard_log("Starting indefinite task.\n");
    // Runs indefinitely, yielding at every iteration. Every iteration, it will spawn more tasks
    long i = 0;
    while (true) {
        // allocate memory for argument
        long *n = calloc(1, sizeof(long));
        *n = i;
        int creation_attempts = 0; // track failed creation attempts
        while (false == task_create(tboard, TBOARD_FUNC(completing_task), TASK_TYPE, n, sizeof(long))) {
            if (creation_attempts >= MAX_TASK_ATTEMPT)
                if (print_verbose)
                    tboard_err("indefinite_task: Could not create new task %d after %d attempts. Yielding.\n", i, creation_attempts);
            creation_attempts++;
            increment_count(&max_task_reached);

            // free n incase termination is called at task_yield();
            free(n);
            task_yield();
            // realloc n, set value
            n = calloc(1, sizeof(long));
            *n = i;
        }
        // spawned new task
        increment_count(&inf_spawned);
        task_yield();
        i++;
    }
}

void completing_task (context_t ctx)
{
    (void)ctx;
    // Generate task to test collatz conjecture for provided x if x is in acceptable range
    long x = *((long *)task_get_args());
    if (x <= 0) {
        increment_count(&com_complete);
        return; // Iteration count is already 0, so we dont spawn any tasks
    }
    // generate collatz_t object to pass copy of to spawning task
    struct collatz_t collatz = {
        .x = x,
        .curr_x = x,
        .iterations = 0,
    };

    int creation_attempts = 0;

    // copy collatz_t object
    struct collatz_t *col = calloc(1, sizeof(struct collatz_t));
    memcpy(col, &collatz, sizeof(struct collatz_t));

    while (false == task_create(tboard, TBOARD_FUNC(spawning_task), TASK_TYPE, col, sizeof(struct collatz_t))) {
        if (creation_attempts >= MAX_TASK_ATTEMPT)
            if (print_verbose)
                tboard_err("completing_task: Could not create new task %d after %d attempts. Yielding.\n", x, creation_attempts);
        creation_attempts++;
        increment_count(&max_task_reached);

        // free col incase termination is called at task_yield();
        free(col);
        task_yield(); // cancellation point
        // realloc col, set value
        col = calloc(1, sizeof(struct collatz_t));
        memcpy(col, &collatz, sizeof(struct collatz_t));
    }
    increment_count(&com_spawned);
    increment_count(&com_complete);
}

void spawning_task (context_t ctx)
{
    (void)ctx;
    // Generate blocking task for each iteration to test collatz conjecture for provided x if x is in acceptable range
    struct collatz_t *col = (struct collatz_t *)task_get_args();
    while (col->curr_x != 1) { // spawn blocking task to test current iteration
        // we pass 0 for sizeof_args so task board does not free col value after completing (so it persists after
        // blocking task terminates)
        bool res = blocking_task_create(tboard, TBOARD_FUNC(blocking_task), TASK_TYPE, col, 0);
        if (!res) { // creating blocking task failed
            tboard_err("spawning_task: Could not create blocking task x=%d/%d at iteration %d\n", col->curr_x, col->x, col->iterations);
            return;
        } else { // creating blocking task worked so we increment iterations
            col->iterations++;
            increment_count(&spa_spawned);
            task_yield();
        }
    }
    if (print_verbose)
        tboard_log("spawning_task: x=%d converged to 1 after %d iterations.\n", col->x, col->iterations);
    increment_count(&spa_complete);
}

void blocking_task (context_t ctx)
{
    (void)ctx;
    // we perform: if x % 2 == 0, x /= 2, else x = 3x + 1
    struct collatz_t *col = (struct collatz_t *)task_get_args();
    if (col->curr_x % 2 == 0)
        col->curr_x /= 2;
    else
        col->curr_x = 3 * (col->curr_x) + 1;
    increment_count(&blo_complete);
}






#endif