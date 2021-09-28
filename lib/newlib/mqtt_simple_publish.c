/**
 * @file
 * A simple program to that publishes the current time whenever ENTER is pressed. 
 */
#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>

#include "mqtt.h"
#include "posix_sockets.h"

#include "baseexecutor.h"

const char* addr;
const char* port;
const char* topic, *topic2;
_Atomic(int) to_continue = 1;
SchedulerManager scheduler_manager;

/**
 * @brief The function that would be called whenever a PUBLISH is received.
 * 
 * @note This function is not used in this example. 
 */
void publish_callback(void** unused, struct mqtt_response_publish *published);

/**
 * @brief The client's refresher. This function triggers back-end routines to 
 *        handle ingress/egress traffic to the broker.
 * 
 * @note All this function needs to do is call \ref __mqtt_recv and 
 *       \ref __mqtt_send every so often. I've picked 100 ms meaning that 
 *       client ingress/egress traffic will be handled every 100 ms.
 */
void client_refresher();

/**
 * @brief Safelty closes the \p sockfd and cancels the \p client_daemon before \c exit. 
 */
void exit_example(int status, int sockfd, void *client_daemon);
uint8_t sendbuf1[2048 * 4 * 1024], sendbuf2[2048 * 4 * 1024];
uint8_t recvbuf1[1024 * 4 * 1024], recvbuf2[2048 * 4 * 1024];
DeclBatchTask(client_daemon, 4096 * 4);
int sockfd1;
void Main() {
    void* self;
    char** argv;
    
    BeginTask();

    GetActiveTask(&self);
    GetTaskData(&argv, self);
            
    

    /* start a thread to refresh the client (handle egress and ingree client traffic) */
    /*if(CreateBatchTask(client_daemon, CreateContext, 4096 * 4, client_refresher) ||
       SetTaskData(client_daemon, &client) ||
       EnableTask(client_daemon)) {
        fprintf(stderr, "Failed to start client daemon.\n");
        exit_example(EXIT_FAILURE, sockfd, NULL);
    }*/

    /* start publishing the time */
    printf("%s is ready to begin publishing the time.\n", argv[0]);
    printf("Press ENTER to publish the current time.\n");
    printf("Press CTRL-D (or any other key) to exit.\n\n");
    // fgetc(stdin) == '\n'
    struct timespec then, now;
    Maintenant(&then);
    int i = 0;
    while(1) {
        struct timespec t1, t2;
        Maintenant(&t1);
        /* open the non-blocking TCP socket (connecting to the broker) */
        sockfd1 = open_nb_socket(addr, port);
        int sockfd2 = open_nb_socket(addr, port);
        
        if (sockfd1 == -1) {
            perror("Failed to open socket: ");
            exit_example(EXIT_FAILURE, sockfd1, NULL);
        }
        Maintenant(&t2);
        if (timespec_sub(t2, t1).tv_nsec > 50000) {
            
            printf("%d-th iter -- socket takes %zu secs, %zu nsec\n", i, timespec_sub(t2, t1).tv_sec, timespec_sub(t2, t1).tv_nsec);
        }
        /* setup a client */
        struct mqtt_client client, client2;
        /* sendbuf should be large enough to hold multiple whole mqtt messages */
        /* recvbuf should be large enough any whole mqtt message expected to be received */
        mqtt_init(&client, sockfd1, sendbuf1, sizeof(sendbuf1), recvbuf1, sizeof(recvbuf1), publish_callback);
        mqtt_init(&client2, sockfd2, sendbuf2, sizeof(sendbuf2), recvbuf2, sizeof(recvbuf2), publish_callback);
        /* Create an anonymous session */
        const char* client_id = NULL;
        /* Ensure we have a clean session */
        uint8_t connect_flags = MQTT_CONNECT_CLEAN_SESSION;
        // printf("connect\n");
        /* Send connection request to the broker. */
        mqtt_connect(&client, client_id, NULL, NULL, 0, NULL, NULL, connect_flags, 400);
        mqtt_connect(&client2, client_id, NULL, NULL, 0, NULL, NULL, connect_flags, 400);
        /* check that we don't have any errors */
        if (client.error != MQTT_OK) {
            fprintf(stderr, "error: %s\n", mqtt_error_str(client.error));
            exit_example(EXIT_FAILURE, sockfd1, NULL);
        }
        /* get the current time */
        time_t timer;
        time(&timer);
        struct tm* tm_info = localtime(&timer);
        char timebuf[26];
        strftime(timebuf, 26, "%Y-%m-%d %H:%M:%S", tm_info);

        /* print a message */
        char application_message[256];
        snprintf(application_message, sizeof(application_message), "The time is %s", timebuf);
        // printf("%s published at %d-th : \"%s\"\n", argv[0], i, application_message);

        /* publish the time */
        mqtt_publish(&client, topic, application_message, strlen(application_message) + 1, MQTT_PUBLISH_QOS_0);
        mqtt_sync(&client);
        mqtt_publish(&client2, topic2, application_message, strlen(application_message) + 1, MQTT_PUBLISH_QOS_0);
        mqtt_sync(&client2);
        /* check for errors */
        if (client.error != MQTT_OK) {
            fprintf(stderr, "error: %s\n", mqtt_error_str(client.error));
            exit_example(EXIT_FAILURE, sockfd1, &client_daemon);
        }
        
        mqtt_disconnect(&client);
        mqtt_sync(&client);
        mqtt_disconnect(&client2);
        mqtt_sync(&client2);
        /* exit */ 
        close(sockfd1);
        close(sockfd2);
        // printf("%d\n", i++);
        if (i++ == 65535) {
            Maintenant(&now);
            struct timespec elp = timespec_sub(now, then);
            printf("elapsed %zu sec, %ld ns\n", elp.tv_sec, elp.tv_nsec);
        }
        // RelinquishTask();
    }   

    /* disconnect */
    printf("\n%s disconnecting from %s\n", argv[0], addr);
    CurrentTaskWaitFor((struct timespec){1, 0});
    FinishTask();
}

/**
 * A simple program to that publishes the current time whenever ENTER is pressed. 
 */
int main(int argc, const char *argv[]) 
{
    DeclBatchTask(main_task, 4096 * 4);

    /* get address (argv[1] if present) */
    if (argc > 1) {
        addr = argv[1];
    } else {
        addr = "test.mosquitto.org";
    }

    /* get port number (argv[2] if present) */
    if (argc > 2) {
        port = argv[2];
    } else {
        port = "1883";
    }

    /* get the topic name to publish */
    if (argc > 3) {
        topic = argv[3];
    } else {
        topic = "datetime";
        topic2 = "datetime2";
    }

    CreateSchedulerManager(&scheduler_manager);
    AddExecutor(&scheduler_manager, NULL, NULL);
    AddTimer(&scheduler_manager, 2, (struct timespec){0, 5000});
    CreateBatchTask(main_task, CreateContext, 4096 * 4, Main);
    SetTaskData(main_task, argv);
    EnableTaskOnExecutorWithMinimumNumberOfTask(main_task, &scheduler_manager);
    BeginAllExecutors(&scheduler_manager);
    WaitAndClearSchedulerManager(&scheduler_manager);
    return 0;
}

void exit_example(int status, int sockfd, void *client_daemon)
{
    if (sockfd != -1) close(sockfd);
    if (client_daemon != NULL) {
        to_continue = 0;
        //WaitForTaskUntilFinish(client_daemon);
    }
    // EndAllExecutors(&scheduler_manager);
    // FinishTask();
}

void publish_callback(void** unused, struct mqtt_response_publish *published) 
{
    /* not used in this example */
    printf("TOPIC: %s, Payload: %s\n", published->topic_name, published->application_message);
}

void client_refresher()
{
    BeginTask();
    void *self, *client;
    GetActiveTask(&self);
    GetTaskData(&client, self);
    while(to_continue) 
    {
        
        RelinquishTask();
    }
    FinishTask();
}