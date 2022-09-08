/**
 * 
 * Indicates which test to run
 * 
 * TEST_NUM = 1 is Milestone 1
 * TEST_NUM = 2 is Milestone 1b
 * TEST_NUM = 3 is Milestone 2
 * TEST_NUM
 * 
 * 
 */
#ifndef __TESTS_H_
#define __TESTS_H_

#include "../main_main.h"
#include "../tboard.h"
#include <pthread.h>



#define SECONDARY_EXECUTORS 2
#define NUM_TASKS 100
#define MAX_RUN_TIME 10 // seconds
#define MAX_TASK_ATTEMPT 50
#define RAPID_GENERATION 0


#if RUN_TEST == 1
    #if TEST_NUM == 1
        #define TEST_1
    #elif TEST_NUM == 2
        #define TEST_2
    #elif TEST_NUM == 3
        #define TEST_3
    #elif TEST_NUM == 4
        #define TEST_4
    #elif TEST_NUM == 5
        #define TEST_5
    #elif TEST_NUM == 6
        #define TEST_6
    #elif TEST_NUM == 7
        #define TEST_7
    #elif TEST_NUM == 8
        #define TEST_8
    #elif TEST_NUM == 9
        #define TEST_9
    #elif TEST_NUM == 10
        #define TEST_10
    #elif TEST_NUM == 11
        #define TEST_11
    #endif
#endif


/**
 * thread_f - Thread Function Signature
 * 
 * A thread function must have the following signature:
 * 
 * void *func(void *args);
 */
typedef void *(*thread_f)(void *args);

/**
 * task_f - Task Function Signature
 * 
 * A task function must have the following signature:
 * 
 * void func(context_t ctx);
 */
typedef void (*task_f)(context_t ctx);

////////////// IMPLEMENTED IN TESTS ///////////////////
void init_tests();
/**
 * init_tests() - Initializes tests. Implemented in test
 * 
 * This function should initialize mutexs, initialize tboard,
 * and create appropriate threads
 */

void destroy_tests();
/**
 * destroy_tests() - Destroys tests. Implemented in test
 * 
 * This function should destroy mutex, destroy task board,
 * join pthreads
 */

void *kill_tboard(void *args);
/**
 * kill_tboard() - Kills task board after random amount of time
 * @args: user's discretion
 * 
 * If implemented, this function should kill the task board after
 * a random amount of time
 */

void *check_completion(void *args);
/**
 * check_completion() - Kills task board after tasks have completed
 * @args: user's discretion
 * 
 * Checks completion
 */


////////////////////////////////////////////////////
//////////////// HELPER FUNCTIONS //////////////////
////////////////////////////////////////////////////
double rand_double(double min, double max);
/**
 * rand_double() - Generates random float number between [min, max]
 * @min: minimum range of random number
 * @max: maximum range of random number
 */

void fsleep(float max_second);
/**
 * fsleep() - Sleeps for amount of seconds within [0, max_seconds]
 * @max_seconds: maximum amount of time to sleep in seconds
 * 
 * Puts thread to sleep for random amount of time, capping at max_seconds
 */

void increment_count(int *count);
/**
 * increment_count() - Increments value safely
 * @count: Value to increment
 * 
 * Context: locks count_mutex
 */

int read_count(int *count);
/**
 * read_count() - Reads value safely
 * @count: Value to increment
 * 
 * Context: locks count_mutex
 * 
 * Return: value of @count
 */


#endif