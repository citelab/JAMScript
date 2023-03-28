#include "dpanel.h"
#include <stdio.h>
#include <unistd.h>

int count = 1;

/*
 * One data panel connects to a Redis server. 
 */
dpanel_t *dpanel_create(char *server, int port)
{
    dpanel_t *dp = (dpanel_t *)calloc(sizeof(dpanel_t), 1);
    assert(dp != NULL);

    assert(server != NULL);
    assert(port != 0);
    strcpy(dp->server, server);
    dp->port = port;

    assert(pthread_mutex_init(&(dp->ufmutex), NULL) == 0);
    assert(pthread_mutex_init(&(dp->dfmutex), NULL) == 0);
    assert(pthread_cond_init(&(dp->ufcond), NULL) == 0);
    assert(pthread_cond_init(&(dp->dfcond), NULL) == 0);

    dp->ufqueue = queue_create();
    dp->dfqueue = queue_create();

    queue_init(&(dp->ufqueue));
    queue_init(&(dp->dfqueue));

    return dp;
}

void dpanel_connect_cb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Connected...\n");
}

void dpanel_disconnect_cb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Disconnected...\n");
}


void dpanel_ucallback2(redisAsyncContext *c, void *r, void *privdata) {
    
    redisReply *reply = r;
    dpanel_t *dp = (dpanel_t *)privdata;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    printf("----------- Hi --------------\n");

    for (int i = 0; i < 10000; i++) {
        char temp[64];
        int i = count++;
        sprintf(temp, "set key-%d value-%d", i, i);
        redisAsyncCommand(dp->uctx, NULL, NULL, temp);
    }
//    for (int i = 0; i < 1000; i++) {
        char temp[64];
        int i = count++;
        sprintf(temp, "set key-%d value-%d", i, i);
        redisAsyncCommand(dp->uctx, dpanel_ucallback2, dp, temp);
  //  }
}

void dpanel_ucallback(redisAsyncContext *c, void *r, void *privdata) {
    
    redisReply *reply = r;
    dpanel_t *dp = (dpanel_t *)privdata;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }
    printf("Reply received : %lld\n", reply->integer);

    for (int i = 0; i < 10000; i++) {
        char temp[64];
        int i = count++;
        sprintf(temp, "set key-%d value-%d", i, i);
        redisAsyncCommand(dp->uctx, NULL, NULL, temp);
    }
//    for (int i = 0; i < 1000; i++) {
        char temp[64];
        int i = count++;
        sprintf(temp, "set key-%d value-%d", i, i);
        redisAsyncCommand(dp->uctx, dpanel_ucallback2, dp, temp);
  //  }



}

void *dpanel_ufprocessor(void *arg) 
{
    dpanel_t *dp = (dpanel_t *)arg;

    // Initialize the event loop
    dp->uloop = event_base_new();

    dp->uctx = redisAsyncConnect(dp->server, dp->port);
    if (dp->uctx->err)
    {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", dp->server, dp->port);
        exit(1);
    }

    redisLibeventAttach(dp->uctx, dp->uloop);
    redisAsyncSetConnectCallback(dp->uctx, dpanel_connect_cb);
    redisAsyncSetDisconnectCallback(dp->uctx, dpanel_disconnect_cb);

    redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall get_id 0 test_key_key");
    event_base_dispatch(dp->uloop);
    // the above call is blocking... so we come here after the loop has exited

    return NULL;
}

void *dpanel_dfprocessor() 
{
    return NULL;
}

void dpanel_start(dpanel_t *dp)
{
    int rval;
    rval = pthread_create(&(dp->ufprocessor), NULL, dpanel_ufprocessor, (void *)dp);
    if (rval != 0) {
        perror("ERROR! Unable to start the dpanel ufprocessor thread");
        exit(1);
    }

    rval = pthread_create(&(dp->dfprocessor), NULL, dpanel_dfprocessor, (void *)dp);
    if (rval != 0) {
        perror("ERROR! Unable to start the dpanel dfprocessor thread");
        exit(1);
    }

    pthread_join(dp->ufprocessor, NULL);
    pthread_join(dp->dfprocessor, NULL);
}

void dpanel_shutdown(dpanel_t *dp)
{

}

uflow_t *dp_create_uflow(dpanel_t *dp)
{
    return NULL;
}

dflow_t *dp_create_dflow(dpanel_t *dp)
{
    return NULL;
}

void ufwrite(uflow_t *uf)
{

}

void dfread(dflow_t *df)
{

}
