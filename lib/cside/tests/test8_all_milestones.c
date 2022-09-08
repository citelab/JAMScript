/**
 * Test 8: Tests all milestones by doing a variety of different tasks
 * 
 * Task types:
 * 
 * * Worker to Controller: Will randomly issue blocking and non-blocking tasks to controller
 * * Controller to Worker: Will randomly simulate MQTT receiving task from controller to run locally
 * * Priority Tasks: Will randomly issue priority tasks to be completed ASAP and record amount of time done
 * * Primary Tasks: Will issue non-blocking secondary tasks and then terminate
 * * Secondary Tasks: Will issue blocking tasks to test collatz conjecture for a given x, then print result if specified to do so
 * * Blocking Tasks: Will iterate until completion, yielding each iteration and then terminate
 * 
 * 
 * This test essentially combines all of the previous tests
 * 
 * In order to show intermediate print statements, call function with any argument
 * 
 * This test has minimal documentation as it copies code from all other tests
 */

#include "tests.h"
#ifdef TEST_8

#include "../tboard.h"
#include "../dummy_MQTT.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>

#define ISSUE_PRIORITY_TASKS 1
#define MAX_TIME_BETWEEN_PRIORITY 0.1

/**
 * 
 * Variable declaration
 */
struct collatz_t {
    long x;
    long curr_x;
    long iterations;
};

long kill_time, test_time;

int messages_sent = 0;
int omessages_sent = 0;
int omessages_recv = 0;
int max_task_reached = 0;

int num_priority = 0;
int cpu_priority = 0;

int completion_count = 0;
int scompletion_count = 0;
int stask_count = 0;
int task_count = 0;

pthread_t message_generator, pgen_thread;

bool print_priority = false;
bool primary_task_complete = false;
bool task_gen_complete = false;

struct MQTT_data mqtt_data = {0};

/**
 * function prototypes
 */
void priority_task(context_t ctx);
void primary_task(context_t ctx);
void secondary_task(context_t ctx);
void blocking_task(context_t ctx);
void remote_task(context_t ctx);

void remote_task_gen(context_t ctx);

void *priority_task_gen(void *args);
void *generate_MQTT_message(void *args);


int main(int argc, char **argv)
{
    (void)argv;
    if (argc > 1)
        print_priority = true;

    test_time = clock();
    init_tests();

    task_create(tboard, TBOARD_FUNC(primary_task), PRIMARY_EXEC, NULL, 0);
    task_create(tboard, TBOARD_FUNC(remote_task_gen), PRIMARY_EXEC, NULL, 0);

    destroy_tests();
    test_time = clock() - test_time;

    printf("\n=================== TEST STATISTICS ================\n");
    printf("\t%d/%d/%d sub tasks completed.\n", scompletion_count, stask_count, NUM_TASKS);
    printf("\t%d priority tasks were issued, with mean completion time of %f CPU cycles.\n", num_priority, (double)cpu_priority/num_priority);
    printf("\tMax task count reached %d times.\n",max_task_reached);
    printf("\tSent %d/%d remote tasks to MQTT, %d were received, %d were responded to.\n",omessages_recv, omessages_sent, mqtt_data.omsg_recv, mqtt_data.omsg_sent);
    printf("\tIssued %d local tasks to MQTT, %d were received, %d were completed.\n", messages_sent, mqtt_data.imsg_recv, mqtt_data.imsg_sent);

    printf("\nTest took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n",test_time, kill_time);

    tboard_exit();
}

void init_tests()
{
    tboard = tboard_create(SECONDARY_EXECUTORS);

    tboard_start(tboard);
    MQTT_init(tboard);

    pthread_create(&message_generator, NULL, generate_MQTT_message, tboard);
    pthread_create(&pgen_thread, NULL, priority_task_gen, tboard);
    pthread_create(&tb_killer, NULL, kill_tboard, tboard);

    printf("Taskboard created, all threads initialized.\n");
}

void destroy_tests()
{
    pthread_join(message_generator, NULL);
    pthread_join(pgen_thread, NULL);
    tboard_destroy(tboard);
    pthread_join(tb_killer, NULL);
    MQTT_destroy();
}

void priority_task(context_t ctx)
{
    (void)ctx;
    long cpu_time = *((long *)(task_get_args()));
    int i = num_priority;
    if(print_priority) tboard_log("priority %d: Started at CPU time %ld.\n", i, cpu_time);
    task_yield();
    task_yield();
    // record execution times
    cpu_time = clock() - cpu_time;
    pthread_mutex_lock(&count_mutex);
    num_priority++;
    cpu_priority += cpu_time;
    pthread_mutex_unlock(&count_mutex);
    if(print_priority) tboard_log("priority %d: Finished after CPU time %ld.\n", i, cpu_time);
}


void primary_task(context_t ctx)
{
    (void)ctx;

    struct collatz_t *col = NULL;
    for (long i=0; i<NUM_TASKS; i++) {
        int attempts = 0;
        struct collatz_t collatz = {
            .x = i,
            .curr_x = i,
            .iterations = 0,
        };
        col = calloc(1, sizeof(struct collatz_t));
        memcpy(col, &collatz, sizeof(struct collatz_t));
        while(false == task_create(tboard, TBOARD_FUNC(secondary_task), SECONDARY_EXEC, col, sizeof(struct collatz_t))) {
            if (attempts > MAX_TASK_ATTEMPT) {
                tboard_log("primary: Was unable to create the same task after 30 attempts. Ending at %d tasks created.\n",i);
                primary_task_complete = true;
				free(col);
                return;
            }
            attempts++;
            max_task_reached++;
            
            free(col);
            fsleep(0.0003);
            task_yield();
            col = calloc(1, sizeof(struct collatz_t));
            memcpy(col, &collatz, sizeof(struct collatz_t));
        }
        stask_count++;
        task_yield();
    }
    primary_task_complete = true;
}

void secondary_task(context_t ctx)
{
    (void)ctx;
    struct collatz_t *col = ((struct collatz_t *)task_get_args());
    
    bool res = blocking_task_create(tboard, TBOARD_FUNC(blocking_task), SECONDARY_EXEC, col, 0);
    if (res && print_priority)
        tboard_log("secondary_task: x=%ld converged after %ld iterations.\n", col->x, col->iterations);
    
    increment_count(&scompletion_count);
}
void blocking_task(context_t ctx)
{
    (void)ctx;
    struct collatz_t *col = ((struct collatz_t *)task_get_args());
    if (col->x <= 0)
        return;
    
    while (col->curr_x > 1) {
        if (col->curr_x % 2 == 0)
            col->curr_x /= 2;
        else
            col->curr_x = 3*(col->curr_x) + 1;
        task_yield();
    }
}


void remote_task(context_t ctx)
{
    (void)ctx;
    increment_count(&omessages_sent);
    if (rand() % 2 == 0) {
        remote_task_t rtask = {0};
        strcpy(rtask.message, "print");
        char *pmessage = calloc(20, sizeof(char));
        strcpy(pmessage, "Hello World!");
        bool res = remote_task_create(tboard, "print", pmessage, strlen(pmessage), TASK_ID_NONBLOCKING);
        if (!res) {
            free(pmessage);
            tboard_err("Could not create remote task 'print Hello World!'\n");
        }
        increment_count(&completion_count);
    } else {
        struct rarithmetic_s mathing = {0};
        mathing.a = rand_double(1.0, 10.0);
        mathing.b = rand_double(1.0, 10.0);
        char ops[] = "+-/*";
        mathing.operator = ops[rand() % 4];

        bool res = remote_task_create(tboard, "math", &mathing, 0, TASK_ID_BLOCKING);
        if (res) {
            printf("Remotely computed %f %c %f = %f\n", mathing.a, mathing.operator, mathing.b, mathing.ans);
            
        } else {
            tboard_err("Could not create remote task 'math %f %c %f'\n", mathing.a, mathing.operator, mathing.b);
        }
        increment_count(&completion_count);
    }
    increment_count(&omessages_recv);
}

void remote_task_gen(context_t ctx)
{
    (void)ctx;
    int i = 0;
    while(true) {
        if (RAPID_GENERATION == 0 && i >= NUM_TASKS) 
            break;

        int unable_to_create_task_count = 0; // bad name i know
        int *n = calloc(1, sizeof(int));
        *n = i;
        while(false == task_create(tboard, TBOARD_FUNC(remote_task), PRIMARY_EXEC, n, sizeof(int))) {
            if (unable_to_create_task_count > MAX_TASK_ATTEMPT) {
                free(n);
                tboard_log("remote_task_gen: Was unable to create the same task after %d attempts. Ending at %d tasks created.\n",MAX_TASK_ATTEMPT, i);
                task_gen_complete = true;
                return;
            }
            max_task_reached++;
            fsleep(0.0003);
            free(n);
            task_yield();
            n = calloc(1, sizeof(int)); *n = i;
            unable_to_create_task_count++;
        }
        task_count++;
        task_yield();
        
        i++;
        if (RAPID_GENERATION == 1)
            fsleep(0.5);
    }
    task_gen_complete = true;
    tboard_log("remote_task_gen: Finished creating %d remote tasks.\n",task_count);
    return;
}


void *generate_MQTT_message(void *args)
{
    (void)args;
    char operators[] = "+-/*";
    while(true)
    {
        int cmd = rand() % 3;
        switch(cmd){
            case 0:
                MQTT_send("print 'hello world!'\n");
                break;
            case 1:
                ;
                int opn = rand() % 4;
                char op = operators[opn];
                char message[50] = {0}; // char *message = calloc(50, sizeof(char)); //
                sprintf(message, "math %d %c %d",rand()%500, op, rand()%500);
                MQTT_send(message);
                break;
            case 2:
                MQTT_send("spawn");
                break;
        }
        messages_sent++;
        if(RAPID_GENERATION == 1) fsleep(0.0003);
        else fsleep(0.1);
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
        long *cput = calloc(1, sizeof(long));
        *cput = clock();
        bool res = task_create(t, TBOARD_FUNC(priority_task), PRIORITY_EXEC, cput, sizeof(long));
        if (!res) {
            free(cput);
            tboard_log("priority_task_gen: Unable to create priority task %d as max concurrent tasks has been reached.\n", num_priority);
        }
    }
}

void *kill_tboard (void *args)
{
    tboard_t *t = (tboard_t *)args;
    if(RAPID_GENERATION == 1) {
        fsleep(MAX_RUN_TIME);
        printf("Random time hit, killing task board.\n");
    } else {
        while (true) {
            if (primary_task_complete && task_gen_complete) {
                if (read_count(&completion_count) >= task_count && read_count(&scompletion_count) >= stask_count) {
                    break;
                } else {
                    tboard_log("kill_tboard: Completed %d/%d MQTT tasks, %d/%d local tasks.\n", read_count(&completion_count), task_count, read_count(&scompletion_count), stask_count);
                }
            }
            fsleep(1);
        }
    }
    pthread_mutex_lock(&(t->tmutex));
    pthread_cancel(message_generator);
    pthread_cancel(pgen_thread);

    kill_time = clock();
    MQTT_kill(&mqtt_data);
    tboard_kill(t);
    kill_time = clock() - kill_time;
    
    printf("=================== TASK STATISTICS ================\n");
    history_print_records(t, stdout);
    pthread_mutex_unlock(&(t->tmutex));
    return NULL;
}

#endif