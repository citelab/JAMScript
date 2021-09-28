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
const char* topic;
_Atomic(int) to_continue = 1;
SchedulerManager scheduler_manager;
uint64_t count;

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
uint8_t sendbuf[2048 * 1024];
uint8_t recvbuf[1024 * 1024];
void Main() {
    void* self;
    char** argv;
    DeclBatchTask(client_daemon, 4096);
    BeginTask();
    GetActiveTask(&self);
    GetTaskData(&argv, self);
    /* open the non-blocking TCP socket (connecting to the broker) */
    int sockfd = open_nb_socket(addr, port);

    if (sockfd == -1) {
        perror("Failed to open socket: ");
        exit_example(EXIT_FAILURE, sockfd, NULL);
    }
    /* setup a client */
    struct mqtt_client client;
     /* sendbuf should be large enough to hold multiple whole mqtt messages */
     /* recvbuf should be large enough any whole mqtt message expected to be received */
    mqtt_init(&client, sockfd, sendbuf, sizeof(sendbuf), recvbuf, sizeof(recvbuf), publish_callback);
    /* Create an anonymous session */
    const char* client_id = NULL;
    /* Ensure we have a clean session */
    uint8_t connect_flags = MQTT_CONNECT_CLEAN_SESSION;
    /* Send connection request to the broker. */
    mqtt_connect(&client, client_id, NULL, NULL, 0, NULL, NULL, connect_flags, 400);

    /* check that we don't have any errors */
    if (client.error != MQTT_OK) {
        fprintf(stderr, "error: %s\n", mqtt_error_str(client.error));
        exit_example(EXIT_FAILURE, sockfd, NULL);
    }

    /* start a thread to refresh the client (handle egress and ingree client traffic) */
    if(CreateBatchTask(&client_daemon, CreateContext, 4096, client_refresher) ||
       SetTaskData(client_daemon, &client) ||
       EnableTaskOnIndexedExecutor(client_daemon, &scheduler_manager, 1)) {
        fprintf(stderr, "Failed to start client daemon.\n");
        exit_example(EXIT_FAILURE, sockfd, NULL);
    }

    /* subscribe */
    mqtt_subscribe(&client, topic, 0);

    /* start publishing the time */
    printf("%s listening for '%s' messages.\n", argv[0], topic);
    printf("Press CTRL-D to exit.\n\n");
    
    /* block */
    struct timespec then, now, sleep_error;
    Maintenant(&then);
    CurrentTaskWaitFor((struct timespec){1, 0});
    Maintenant(&now);
    sleep_error = timespec_sub(timespec_sub(now, then), (struct timespec){1, 0});
    printf("count=%lu per min\n", count);
    printf("jsleep2 error %zu secs, %ld nsecs\n", sleep_error.tv_sec, sleep_error.tv_nsec);

    /* disconnect */
    printf("\n%s disconnecting from %s\n", argv[0], addr);
    CurrentTaskWaitFor((struct timespec){1, 0});

    /* exit */ 
    exit_example(EXIT_SUCCESS, sockfd, &client_daemon);
}

DeclBatchTask(main_task, 1024 * 1024 * 8);
/**
 * A simple program to that publishes the current time whenever ENTER is pressed. 
 */
int main(int argc, const char *argv[]) 
{
    

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
    }

    CreateSchedulerManager(&scheduler_manager);
    AddExecutor(&scheduler_manager, NULL, NULL);
    AddExecutor(&scheduler_manager, NULL, NULL);
    AddTimer(&scheduler_manager, 1, (struct timespec){0, 5000});
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
        WaitForTaskUntilFinish(client_daemon);
    }
    EndAllExecutors(&scheduler_manager);
    FinishTask();
}

void publish_callback(void** unused, struct mqtt_response_publish *published) 
{
    /* note that published->topic_name is NOT null-terminated (here we'll change it to a c-string) */
    //char* topic_name = (char*) malloc(published->topic_name_size + 1);
    //memcpy(topic_name, published->topic_name, published->topic_name_size);
    //topic_name[published->topic_name_size] = '\0';

    // printf("Received publish('%s'): %s\n", topic_name, (const char*) published->application_message);
    count++;
    //free(topic_name);
}

void client_refresher()
{
    BeginTask();
    void *self, *client;
    GetActiveTask(&self);
    GetTaskData(&client, self);
    while(to_continue) 
    {
        mqtt_sync((struct mqtt_client*) client);
        //RelinquishTask();
        // CurrentTaskWaitFor((struct timespec){0, 50000});
    }
    FinishTask();
}