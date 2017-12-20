#include <unistd.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
#include <pthread.h>
#include <sys/time.h>

int receiveWait;    //how long to sleep when waiting for messages from broadcaster
int sendWait;       //how long tp sleep between sending messages
char* nodeID;
struct timeval  tv1, tv2;
struct tracker{
    char* text;
    struct timeval tv1;
    struct timeval tv2;
    int mtag;
};
struct tracker trackers[600];
char fileName[40];
int tracking = 0;

void sendMessages(){//void* threadid
    printf("In send function\n");
    char messages[600] = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum";

    char* p = strtok(messages, " ");

    int mtag = 0;
    while (p != NULL) {
        int tag = tracking;
        ++tracking;
        //printf("Sent %s at\n", p);
        struct timeval  tv1;
        gettimeofday(&tv1, NULL);
        trackers[tag].text = p;
        trackers[tag].tv1 = tv1;
        trackers[tag].mtag = mtag;
        message = {.text:p, .nodeID:nodeID, .index:tag};   //do logging
        usleep(sendWait);

        p = strtok (NULL, " ");
        ++mtag;
    }
}

//void* receiveMessages(void* threadid){
//    printf("In receive function\n");
//    while (1) {
//        usleep(receiveWait);
//        char* word = sender;
//        printf("Received %s at \n", word);
//
//        FILE *f = fopen("timing.txt", "a");
//        if (f == NULL){
//            printf("Error opening file!\n");
//            continue;
//        }
//
//        /* print some text */
//        const char *text = word;
//        fprintf(f, "Some text: %s\n", text);
//
//        fclose(f);
//    }
//}

jasync receiveMessage(char* mess, char* id, int index){
    if( strcmp(id, nodeID) != 0 )   //if this message is not for this device
        return;

    struct timeval  tv2;
    gettimeofday(&tv2, NULL);
    trackers[index].tv2 = tv2;

     //printf("Received %s\n", mess);
     FILE *f = fopen(fileName, "a");
     if (f == NULL){
         printf("Error opening file!\n");
         return;
     }

     const char* text = mess;
     //fprintf(f, "%s\n", text);

     fprintf(f, "Total time to send and receive %s with tag %d = %f seconds\n", trackers[index].text, trackers[index].mtag,
                      (double) (trackers[index].tv2.tv_usec - trackers[index].tv1.tv_usec) / 1000000 +
                      (double) (trackers[index].tv2.tv_sec - trackers[index].tv1.tv_sec));

     fclose(f);
}

int main(int argc, char** argv){
//    printf("Argument 0 is %s\n", argv[0]);
//    printf("Argument 1 is %s\n", argv[1]);
//    printf("Argument 2 is %s\n", argv[2]);
//    if( argv[3] )
//        printf("Argument 3 is %s\n", argv[3]);
//    if( argv[4] )
//            printf("Argument 4 is %s\n", argv[4]);
//    if( argv[5] )
//            printf("Argument 5 is %s\n", argv[5]);

    printf("C is running...\n");

    nodeID = argv[0];
    sendWait = atoi(argv[1]);
    receiveWait = atoi(argv[2]);

    strcpy(fileName, "results/");
    strcat(fileName, nodeID);
    strcat(fileName, "_timing.txt");

    printf("%s %d %d\n", nodeID, sendWait, receiveWait);

    sleep(3);   //sleep for 3 seconds let the other levels start

    sendMessages();

    //pthread_t thread1, thread2;

    // make threads
    //pthread_create(&thread1, NULL, sendMessages, "1");
    //pthread_create(&thread2, NULL, receiveMessages, "2");

    // wait for them to finish
//    pthread_join(thread1, NULL);
//    pthread_join(thread2, NULL);

    return 0;
}

