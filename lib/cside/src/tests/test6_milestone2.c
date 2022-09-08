/**
 * Test 6: Milestone 2, worker to controller (tboard to MQTT) exclusively
 * 
 * In this test, we issue remote tasks to controller via dummy MQTT. These tests are both
 * blocking and non-blocking. When a non-blocking remote task is issued, task terminates.
 * When a blocking remote task is issued, task is held in message queue until request is 
 * fulfilled or taskboard terminates.
 * 
 * Remote tasks:
 * * "print Hello World!" - Prints task remotely and local task terminates
 * * "math 1 + 1" - Issues arithmetic task remotely, waits until response is received
 * *                then prints it
 * 
 */

#include "tests.h"
#ifdef TEST_6

#include "../tboard.h"
#include "../dummy_MQTT.h"
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <time.h>
#include <assert.h>
#include <stdbool.h>


long kill_time, test_time;

void remote_task(context_t ctx);
void remote_task_gen(context_t ctx);

int imessages_sent = 0;
int omessages_sent = 0;
int omessages_recv = 0;
int max_task_reached = 0;

int completion_count = 0;
int task_count = 0;

bool task_gen_complete = false;

struct MQTT_data mqtt_data = {0};


int main()
{
    test_time = clock();
    init_tests();

    task_create(tboard, TBOARD_FUNC(remote_task_gen), PRIMARY_EXEC, NULL, 0);

    destroy_tests();
    test_time = clock() - test_time;

    printf("\n=================== TEST STATISTICS ================\n");
    printf("\tSent %d/%d remote tasks to MQTT, %d were received, %d were responded to.\n",omessages_recv, omessages_sent, mqtt_data.omsg_recv, mqtt_data.omsg_sent);
    
    printf("\nTest took %ld CPU cycles to complete, killing taskboard took %ld CPU cycles to complete.\n",test_time, kill_time);

    tboard_exit();
}

void init_tests()
{
    tboard = tboard_create(SECONDARY_EXECUTORS);

    tboard_start(tboard);
    MQTT_init(tboard);

    pthread_create(&tb_killer, NULL, kill_tboard, tboard);

    printf("Taskboard created, all threads initialized.\n");
}

void destroy_tests()
{
    tboard_destroy(tboard);
    pthread_join(tb_killer, NULL);
    MQTT_destroy();
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
        // create remote task issuer
        while(false == task_create(tboard, TBOARD_FUNC(remote_task), PRIMARY_EXEC, NULL, 0)) {
            if (unable_to_create_task_count > MAX_TASK_ATTEMPT) {
                tboard_log("remote_task_gen: Was unable to create the same task after %d attempts. Ending at %d tasks created.\n",MAX_TASK_ATTEMPT, i);
                task_gen_complete = true;
                return;
            }
            max_task_reached++;
            fsleep(0.0003);
            task_yield();
            unable_to_create_task_count++;
        }
        task_count++;
        task_yield();
        
        i++;
        // if rapid gen, we are doing this indefinitely in a loop so we want to sleep between issuing
        // as otherwise we would very quickly run out of memory
        if (RAPID_GENERATION == 1) 
            fsleep(0.5);
    }
    task_gen_complete = true;
    tboard_log("remote_task_gen: Finished creating %d remote tasks.\n",task_count);
    return;
}


void *kill_tboard (void *args)
{
    tboard_t *t = (tboard_t *)args;
    if(RAPID_GENERATION == 1) { // if rapid gen we kill after amount of time
        fsleep(MAX_RUN_TIME);
        printf("Random time hit, killing task board.\n");
    } else { // if not rapid gen we complete after number of iterations
        while (true) {
            int cc = read_count(&completion_count);
            if (task_gen_complete && cc >= NUM_TASKS) {
                break;
            } else {
                fsleep(1);
            }
        }
    }
    pthread_mutex_lock(&(t->tmutex));
    
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