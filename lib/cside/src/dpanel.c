#include <stdio.h>
#include <stdbool.h>
#include <unistd.h>
#include "base64.h"
#include "cnode.h"
#include "dpanel.h"


/*
 * Some forward declarations
 */
void *dpanel_ufprocessor(void *arg);
void dpanel_ucallback(redisAsyncContext *c, void *r, void *privdata);
void *dpanel_dfprocessor(void *arg);
void dpanel_dcallback(redisAsyncContext *c, void *r, void *privdata);
void dflow_callback(redisAsyncContext *c, void *r, void *privdata);


struct queue_entry *get_uflow_object(dpanel_t *dp, bool *last);
void freeUObject(uflow_obj_t *uobj);

/*
 * MAIN DATA PANEL FUNCTIONS
 * For creating, starting, shutting down, etc.
 */

/*
 * The data panel connects to a main Redis server. That is, the data panel
 * is not started without a Redis server (this is the device-level Redis server). 
 * Once the data panel is running, we can add Redis servers at the fog level and also 
 * delete fog servers. 
 */
dpanel_t *dpanel_create(char *server, int port, char *uuid)
{
    // all values in dpanel_t structure are initialized to 0 by default
    dpanel_t *dp = (dpanel_t *)calloc(sizeof(dpanel_t), 1);
    assert(dp != NULL);

    assert(server != NULL);
    assert(port != 0);
    strcpy(dp->server, server);
    dp->port = port;
    dp->uuid = uuid;

    assert(pthread_mutex_init(&(dp->ufmutex), NULL) == 0);
    assert(pthread_mutex_init(&(dp->dfmutex), NULL) == 0);
    assert(pthread_cond_init(&(dp->ufcond), NULL) == 0);
    assert(pthread_cond_init(&(dp->dfcond), NULL) == 0);

    dp->ufqueue = queue_create();
    queue_init(&(dp->ufqueue));

    return dp;
}

void dpanel_setcnode(dpanel_t *dp, cnode_t *cn)
{
    dp->cnode = (void *)cn;
}

void dpanel_settboard(dpanel_t *dp, tboard_t *tb) 
{
    dp->tboard = (void *)tb;
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
}

void dpanel_shutdown(dpanel_t *dp)
{
    pthread_join(dp->ufprocessor, NULL);
    pthread_join(dp->dfprocessor, NULL);
}

/*
 * UFLOW PROCESSOR FUNCTIONS
 *
 */
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

    redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall get_id 0 %s", dp->uuid);
    event_base_dispatch(dp->uloop);
    // the above call is blocking... so we come here after the loop has exited

    return NULL;
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


void dpanel_ucallback(redisAsyncContext *c, void *r, void *privdata) 
{
    redisReply *reply = r;
    dpanel_t *dp = (dpanel_t *)privdata;
    struct queue_entry *next = NULL; 
    bool last = true;
    cnode_t *cn = (cnode_t *)dp->cnode;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    while (dp->state != REGISTERED && reply->integer <= 0 && dp->ecount <= DP_MAX_ERROR_COUNT) {
        // retry again... for a registration..
        dp->ecount++;
        redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall get_id 0 %s", dp->uuid);
    }

    if (dp->state != REGISTERED && reply->integer <= 0 && dp->ecount > DP_MAX_ERROR_COUNT) {
        fprintf(stderr, "Unable to register with the data store at %s, %d\n", dp->server, dp->port);
        exit(1);
    }

    // do registration..
    if (dp->state != REGISTERED) {
        if (reply->integer > 0) {
            dp->state = REGISTERED;
            dp->logical_id = reply->integer;
        }
    }

    // TODO: enable pipelining... for larger write throughout...
    //
    if (dp->state == REGISTERED) {
        // pull data from the queue
        next = get_uflow_object(dp, &last);
        if (next != NULL) {
            uflow_obj_t *uobj = (uflow_obj_t *)next->data;
            if (last) {
                // send with a callback
                redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall uf_write 1 %s %lu %d %d %f %f %s", uobj->key, uobj->clock, dp->logical_id, cn->width, cn->xcoord, cn->ycoord, uobj->value);
            } else {
                // send without a callback for pipelining.
                redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall uf_write 1 %s %lu %d %d %f %f %s", uobj->key, uobj->clock, dp->logical_id, cn->width, cn->xcoord, cn->ycoord, uobj->value);
            }
            freeUObject(uobj);
            free(next);
        }
    }
}


/*
 * FUNCTIONS for dealing with UFLOW objects
 */

uftable_entry_t *dp_create_uflow(dpanel_t *dp, char *key, char *fmt)
{
    uftable_entry_t *uft = (uftable_entry_t *)calloc(sizeof(uftable_entry_t), 1);
    assert(uft != NULL);
    uft->key = strdup(key);
    uft->fmt = strdup(fmt);
    uft->dpanel = (void *)dp;
    uft->lclock = 0;
    HASH_ADD_STR(dp->uftable, key, uft);
    return uft;
}


struct queue_entry *get_uflow_object(dpanel_t *dp, bool *last) 
{
    struct queue_entry *next = NULL;
    struct queue_entry *nnext;

    while (next == NULL) {
        pthread_mutex_lock(&(dp->ufmutex));
        next = queue_peek_front(&(dp->ufqueue));
        if (next) {
            queue_pop_head(&(dp->ufqueue));
            nnext = queue_peek_front(&(dp->ufqueue));
            if (nnext)
                *last = false;
            else 
                *last = true;
        } else 
            *last = false;
        pthread_mutex_unlock(&(dp->ufmutex));

        if (next == NULL) {
            pthread_mutex_lock(&(dp->ufmutex));
            pthread_cond_wait(&(dp->ufcond), &(dp->ufmutex));
            pthread_mutex_unlock(&(dp->ufmutex));
        }
    }
    return next;
}

void freeUObject(uflow_obj_t *uobj)
{
    free(uobj->value);
    free(uobj);
}


uflow_obj_t *uflow_obj_new(uftable_entry_t *uf, char *vstr) 
{
    uflow_obj_t *uo = (uflow_obj_t *)calloc(sizeof(uflow_obj_t), 1);
    uo->key = uf->key;
    uo->fmt = uf->fmt;
    dpanel_t *dp = uf->dpanel;
    cnode_t *cn = dp->cnode;
    uo->clock = get_jamclock(cn);
    uo->value = strdup(vstr);

    return uo;
}


void ufwrite_int(uftable_entry_t *uf, int x)
{
    dpanel_t *dp = (dpanel_t *)(uf->dpanel);
    struct queue_entry *e = NULL;
    uflow_obj_t *uobj;

    uint8_t buf[16];
    char out[32];

    CborEncoder encoder;
    cbor_encoder_init(&encoder, (uint8_t *)&buf, sizeof(buf), 0);
    cbor_encode_int(&encoder, x);
    int len = cbor_encoder_get_buffer_size(&encoder, (uint8_t *)&buf);
    Base64encode(out, (char *)buf, len);
    uobj = uflow_obj_new(uf, out);

    e = queue_new_node(uobj);
    pthread_mutex_lock(&(dp->ufmutex));
    queue_insert_tail(&(dp->ufqueue), e);
    pthread_cond_signal(&(dp->ufcond));
    pthread_mutex_unlock(&(dp->ufmutex));
}



/*
 * DFLOW PROCESSOR FUNCTIONS
 */
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

// this callback is triggered when a broadcast message is sent by the data store
//
void dpanel_dcallback(redisAsyncContext *c, void *r, void *privdata) 
{
    
    redisReply *reply = r;
    dpanel_t *dp = (dpanel_t *)privdata;
    dftable_entry_t *entry;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    if (reply->type == REDIS_REPLY_ARRAY && (strcmp(reply->element[1]->str, "__d__keycompleted") == 0)) {
        // get the dftable entry ... based on key (reply->element[2]->str) 
        HASH_FIND_STR(dp->dftable, reply->element[2]->str, entry);

        if (entry) {
            pthread_mutex_lock(&(entry->mutex));
            if (entry->state == NEW_STATE)
                entry->state = PRDY_RECEIVED;
            else if (entry->state == CRDY_RECEIVED) 
                entry->state = BOTH_RECEIVED;
            pthread_mutex_unlock(&(entry->mutex));
            if (entry->state == BOTH_RECEIVED && entry->taskid > 0) 
                redisAsyncCommand(dp->dctx, dflow_callback, dp, "fcall df_lread 1 %s", entry->key);
        }
    }
}

// this is callback used by the actual reading function for the data in dflow
// so.. here we need to 
//
void dflow_callback(redisAsyncContext *c, void *r, void *privdata) 
{
    
    redisReply *reply = r;
    // the privdata is pointing to the dftable_entry 
    dftable_entry_t *entry = (dftable_entry_t *)privdata;
    dpanel_t *dp = entry->dpanel;
    tboard_t *t = dp->tboard;
    remote_task_t *rtask = NULL;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    HASH_FIND_INT(t->task_table, &(entry->taskid), rtask);
    if (rtask != NULL)
    {
        rtask->data = strdup("test data"); // TODO: fix this... we need to base64 decode -> CBOR decode -> pass to return value
        rtask->data_size = 1;
        if (rtask->calling_task != NULL)
        {
            rtask->status = DFLOW_TASK_COMPLETED;
            assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
            // place parent task back to appropriate queue - should be batch
            task_place(t, rtask->calling_task);
        }
    }
}


/*
 * FUNCTIONS for dealing with DFLOW objects
 */

// this is function executed by the application task (coroutine)
// it is creating an entry for the variable.
// only done once...
//
dftable_entry_t *dp_create_dflow(dpanel_t *dp, char *key, char *fmt)
{
    // create the dftable_entry, mutex needs to be initialized
    dftable_entry_t *df = (dftable_entry_t *)calloc(sizeof(dftable_entry_t), 1);
    df->key = strdup(key);
    // NOTE: the fmt is used in the decoding process when the data is pulled in
    df->fmt = strdup(fmt);
    df->state = NEW_STATE;
    df->taskid = 0;
    pthread_mutex_init(&df->mutex, NULL);
    // set dpanel.. in the entry..
    df->dpanel = dp;

    // insert into the table - hash table - indexed by the key
    HASH_ADD_STR(dp->dftable, key, df);
    return df;
}


// this invokes the dflow_remote_task() call..
// So.. we are doing a "blocking" call.. we yield 
// the executor and 

void dfread(dftable_entry_t *df, void *val)
{
    
}
