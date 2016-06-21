#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <jam.h>
#include <cbor.h>

#include "hiredis.h"
#include "async.h"
#include "adapters/libevent.h"

jamstate_t *js;

void connectCallback(const redisAsyncContext *c, int status);
void disconnectCallback(const redisAsyncContext *c, int status);
void onMessage(redisAsyncContext *c, void *reply, void *privdata);

void loggerResponse(redisAsyncContext *c, void *reply, void *privdata);

typedef enum {CONNECTED, DISCONNECTED, MESSAGE} jState;


//These would be used to qualify a value being stored on the redis store to make a value/entry distinct
//The appID and the deviceID adds a unique contents from this app and from this device. The idea is that several
//Apps and devices could be writing to the same key on the redis store and so we need all the entries to be added
char *appID = "someID";
char *deviceID = "someDeviceID";
int sequenceNumber = 0;
char *delimiter = "$$$";

//redis server connection parameters
char *redisServerIP;
int redisServerPort;

redisAsyncContext *loggerContext;//for asynchronous calls to logger

struct event_base *base;

void init(){
    base = event_base_new();
}

void requestHandle(){
    redisServerIP = "127.0.0.1";
    redisServerPort = 6379;
}

void registerForBroadcast(){
    redisAsyncContext *c = redisAsyncConnect(redisServerIP, redisServerPort);
    if (c->err) {
        printf("error: %s\n", c->errstr);
        return;
    }

    redisLibeventAttach(c, base);
    redisAsyncSetConnectCallback(c, connectCallback);
    redisAsyncSetDisconnectCallback(c, disconnectCallback);
    redisAsyncCommand(c, onMessage, NULL, "SUBSCRIBE JBROADCAST:testdomain");

}

void initiateRedisConnection(){
    loggerContext = redisAsyncConnect(redisServerIP, redisServerPort);
    if (loggerContext->err) {
        printf("Error: %s\n", loggerContext->errstr);
        // handle error
    }
    redisLibeventAttach(loggerContext, base);
    redisAsyncSetConnectCallback(loggerContext, connectCallback);
    redisAsyncSetDisconnectCallback(loggerContext, disconnectCallback);
    //TODO set disconnect callback on the loggerContext to known when the connection has been broken so that we can reconnect
}

void dispatchEvent(){
    //event_base_dispatch(base);
    //event_base_loop(base, EVLOOP_NONBLOCK);
}

void jam_log(char *key, char *value){
    sequenceNumber++;
    int length = strlen(value) + strlen(delimiter) + strlen(appID) + strlen(delimiter) + strlen(deviceID) + strlen(delimiter) + 10;
    char newValue[length];
    sprintf(newValue , "%s%s%s%s%s%s%d", value, delimiter, appID, delimiter, deviceID, delimiter, sequenceNumber);
    cbor_item_t *c_val = cbor_build_string(newValue);

    unsigned char *buf = NULL;
    int buflen;
    cbor_serialize_alloc(c_val, &buf, &buflen);


    //the loggerResponse is the onMessage handler (when something is received from the redis server),
    //the third parameter is anything to pass to the handler. In this case i think we need to pass a
    //reference to the key being saved so that we can cache the data on the client and/or report to the client
    //if anything failed during saving. Another option would be to return the saved key from the redis server
    //after execution. The limitation to this is that the key would only be returned on successful execution
    redisAsyncCommand(loggerContext, loggerResponse, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); local t = (redis.call('TIME'))[1]; redis.call('ZADD', KEYS[1], t, ARGV[1]); return {t}", key, buf);
    //free(buf);
    printf("At this point!\n");
}






void loggerResponse(redisAsyncContext *c, void *reply, void *privdata){
    redisReply *r = reply;
    printf("APPEAR COME ONE\n");
    //only one value is currently returned (The timestamp). Though in an array format
    if (r->type == REDIS_REPLY_ARRAY) {
        //the returned value can be accessed from reply->element[j]->str or reply->element[j]->str
        printf("Returned Response: %s\n", r->element[0]->str);
    }
    else if(r->type == REDIS_REPLY_ERROR)
        printf("Error: %s\n", r->str);
    else
        printf("APPPPEAR PLS %s\n", r->str);
    //freeReplyObject(r);
}

char* retrieveData(char *key){
    return NULL;
}

void connectCallback(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Connected...\n");
}

void disconnectCallback(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Disconnected...\n");
}

void subscribe(redisAsyncContext *c){
    //the NULL here could be replaced with the user's callback function
    redisAsyncCommand(c, onMessage, NULL, "SUBSCRIBE JBROADCAST:testdomain2");
    printf("Subscribed to testdomain2\n");
}

void unsubscribe(redisAsyncContext *c, char *key){
    //the NULL's here should remain as is. Unless the user wants a callback for the disconnection.
    //In that case we would have to pass that callback to this unsubscribe functions and also to the command
    redisAsyncCommand(c, NULL, NULL, "UNSUBSCRIBE JBROADCAST:%s", key);
    printf("Unsubscribed from %s\n", key);
}


void onMessage(redisAsyncContext *c, void *reply, void *privdata) {
    redisReply *r = reply;
    if (reply == NULL) return;

    if (r->type == REDIS_REPLY_ARRAY) {
        for (int j = 0; j < r->elements; j++) {
            printf("%u) %s\n", j, r->element[j]->str);
        }

        if( !strcmp(r->element[0]->str, "message") && !strcmp(r->element[2]->str, "subscribe") )
            subscribe(c);
    }

    //freeReplyObject(reply);
}


void jam_run_app(void *arg){
    jam_log("richboy", "Hello World");
    while(1){
      printf("Really Blocking\n");
      taskdelay(1000);
    }
}


void jam_redis_event_loop(void *arg){
    init();

    //for implementation, this requestHandle would be replaced by a call to the JNode to retrive a handle for the Redis server (as requested by Professor)
    requestHandle();

    //create async connection to the Redis data store
    initiateRedisConnection();

    //for broadcast implementation
    registerForBroadcast();

    while(1){
      event_base_loop(base, EVLOOP_NONBLOCK);
      taskyield();
    }
}



void taskmain(int argc, char **argv){
    js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running

    taskcreate(jam_event_loop, js, STACKSIZE);

    taskcreate(jam_redis_event_loop, js, STACKSIZE);
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
