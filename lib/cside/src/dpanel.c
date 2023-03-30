#include "dpanel.h"
#include <stdio.h>
#include <unistd.h>

int count = 1;

#define conditional_timedwait(X, Y, T) do {                     \
    struct timespec __wait_time;                                \
    pthread_mutex_lock(X);                                      \
    convert_time_to_absolute(T, &__wait_time);                  \
    pthread_cond_timedwait(Y, X, &__wait_time);                 \
    pthread_mutex_unlock(X);                                    \
} while (0);


/*
 * One data panel connects to a Redis server. 
 */
dpanel_t *dpanel_create(char *server, int port)
{
    dpanel_t *dp = (dpanel_t *)calloc(sizeof(dpanel_t), 1);
    assert(dp != NULL);
    dp->dftable = NULL;             // This is redundant, anyways..
    dp->uftable = NULL;             // This is redundant too

    assert(server != NULL);
    assert(port != 0);
    strcpy(dp->server, server);
    dp->port = port;

    assert(pthread_mutex_init(&(dp->ufmutex), NULL) == 0);
    assert(pthread_mutex_init(&(dp->dfmutex), NULL) == 0);
    assert(pthread_cond_init(&(dp->ufcond), NULL) == 0);
    assert(pthread_cond_init(&(dp->dfcond), NULL) == 0);

    dp->ufqueue = queue_create();
    queue_init(&(dp->ufqueue));

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

void dpanel_connect_dcb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Connected...\n");
}

void dpanel_disconnect_dcb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Disconnected...\n");
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

    // do registration..

    // scan the input queue for data items.. 
    while (1) {
        if (dp->ustate == REGISTERED) {
            // pull data from the queue
            dobject = get_uflow_object(&last);
            if (dobject != NULL) {
                if (last) {
                    // send with a callback
                } else {
                    // send without a callback for pipelining.
                }
            }
        } else {
            // send another registration

        }
        // wait for signalling on condvar or timeout
        conditional_timedwait(&(dp->ufmutex), &(dp->ufcond), UF_TIMEOUT);
    }
}

void dflow_callback(redisAsyncContext *c, void *r, void *privdata) {
    
    redisReply *reply = r;
    dpanel_t *dp = (dpanel_t *)privdata;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    // decode r->str - do a base64 decode, CBOR decode it afterwards

    // create a new queue node 

    // insert it into the dflow queue.. this involves signalling on the cond var
    
    //
}

void dpanel_dcallback(redisAsyncContext *c, void *r, void *privdata) {
    
    redisReply *reply = r;
    dpanel_t *dp = (dpanel_t *)privdata;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    // do the subscription responses.. a dflow entry is written at the data store
    dflow_entry_t *entry = get_dflow_tentry(reply->str);
    if (entry != NULL) {
        switch (entry->type) {
            case DF_READ_TAIL:
                redisAsyncCommand(dp->dctx, dflow_callback, entry, "fcall df_tread 1 %s", entry->key);
            break;

            case DF_READ_HEAD:
                redisAsyncCommand(dp->dctx, dflow_callback, entry, "fcall df_hread 1 %s", entry->key);
            break;
        }
    }
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

void *dpanel_dfprocessor(void *arg) 
{
    dpanel_t *dp = (dpanel_t *)arg;
    // Initialize the event loop
    dp->dloop = event_base_new();

    dp->dctx = redisAsyncConnect(dp->server, dp->port);
    if (dp->dctx->err) {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", dp->server, dp->port);
        exit(1);
    }

    redisLibeventAttach(dp->dctx, dp->dloop);
    redisAsyncSetConnectCallback(dp->dctx, dpanel_connect_dcb);
    redisAsyncSetDisconnectCallback(dp->dctx, dpanel_disconnect_dcb);

    redisAsyncCommand(dp->dctx, dpanel_dcallback, dp, "SUBSCRIBE __d__keycompleted");
    event_base_dispatch(dp->dloop);
    // the above call is blocking... so we come here after the loop has exited

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

uflow_t *dp_create_uflow(dpanel_t *dp, char *key, char *fmt)
{
    return NULL;
}

dflow_t *dp_create_dflow(dpanel_t *dp, char *key, char *fmt)
{
    return NULL;
}

void ufwrite(uflow_t *uf, ...)
{

}

void dfread(dflow_t *df, void *val)
{

}
