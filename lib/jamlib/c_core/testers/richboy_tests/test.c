#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <jam.h>

#include "hiredis.h"

jamstate_t *js;

void jam_run_app(void *arg){
    unsigned int j;
    redisContext *c;
    redisContext *c2;
    redisReply *reply;
    const char *hostname = "127.0.0.1";
    int port =  6379;
    //printf("Hue 1\n");
    struct timeval timeout = { 1, 500000 }; // 1.5 seconds

    c = redisConnectWithTimeout(hostname, port, timeout);
    if (c == NULL || c->err) {
        if (c) {
            printf("Connection error: %s\n", c->errstr);
            redisFree(c);
        } else {
            printf("Connection error: can't allocate redis context\n");
        }
        exit(1);
    }

    printf("Hue 2\n");
    c2 = redisConnectWithTimeout(hostname, port, timeout);
    if (c2 == NULL || c2->err) {
        if (c2) {
            printf("Connection error: %s\n", c2->errstr);
            redisFree(c2);
        } else {
            printf("Connection error: can't allocate redis context\n");
        }
        exit(1);
    }
    //printf("Hue 2\n");

    /*
    printf("Subscribing...\n");

    reply = redisCommand(c2,"SUBSCRIBE testdomain");
    freeReplyObject(reply);
    while(redisGetReply(c2,&reply) == REDIS_OK) {
        printf("Received broadcast message: %s", reply->str);
        // consume message
        freeReplyObject(reply);
    }
    printf("Hue 4\n");
    */


    //store some demo items in the redis server
    reply = redisCommand(c,"SET mykey %s", "Richboy");
    printf("Hue 3\n");
    if (reply->type == REDIS_REPLY_ERROR)
        printf("Error occured: %s\n", reply->str);
    else
        printf("Data added!\n");
    freeReplyObject(reply);


    /* Disconnects and frees the context */
    redisFree(c);
    redisFree(c2);
    //printf("Hue 4\n");
}



void taskmain(int argc, char **argv)
{
    js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    /*
    activity_regcallback(js->atable, "alive", ASYNC, "s", callalive);
    activity_regcallback(js->atable, "workasync", ASYNC, "s", callworkasync);
    activity_regcallback(js->atable, "worksync", SYNC, "s", callworksync);
    */
    printf("Commencing JAM operation \n");
}

//*/
