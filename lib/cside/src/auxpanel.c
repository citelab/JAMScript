#include <stdio.h>
#include <stdbool.h>
#include <unistd.h>
#include "auxpanel.h"
#include "dpanel.h"
#include "cnode.h"


// forward declarations

void *apanel_ufprocessor(void *arg);
void *apanel_dfprocessor(void *arg);
void apanel_ucallback(redisAsyncContext *c, void *r, void *privdata);




/*
 * AUX DATA PANEL FUNCTIONS
 * For creating, starting, shutting down, etc.
 */

auxpanel_t *apanel_create(void *dpanel, char *server, int port)
{
    auxpanel_t *ap = (auxpanel_t *)calloc(sizeof(auxpanel_t), 1);
    assert(ap != NULL);

    assert(server != NULL);
    assert(port != 0);
    strcpy(ap->server, server);
    ap->port = port;

    assert(pthread_mutex_init(&(ap->a_ufmutex), NULL) == 0);
    assert(pthread_mutex_init(&(ap->a_dfmutex), NULL) == 0);
    assert(pthread_cond_init(&(ap->a_ufcond), NULL) == 0);
    assert(pthread_cond_init(&(ap->a_dfcond), NULL) == 0);

    ap->a_ufqueue = queue_create();
    queue_init(&(ap->a_ufqueue));

    ap->dpanel = dpanel;

    return ap;
}

void apanel_free(auxpanel_t *ap)
{

    // TODO: Need to destroy mutexes and free queue entries..
    // Need lots of cleaning up before releasing the auxpanel...
    // Also, auxpanel needs to be locked while being cleaned up
    free(ap);
}

void apanel_connect_cb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Connected...\n");
}

void apanel_disconnect_cb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Disconnected...\n");
}

void apanel_start(auxpanel_t *ap)
{
    int rval;
    rval = pthread_create(&(ap->a_ufprocessor), NULL, apanel_ufprocessor, (void *)ap);
    if (rval != 0) {
        perror("ERROR! Unable to start the dpanel ufprocessor thread");
        exit(1);
    }

    rval = pthread_create(&(ap->a_dfprocessor), NULL, apanel_dfprocessor, (void *)ap);
    if (rval != 0) {
        perror("ERROR! Unable to start the dpanel dfprocessor thread");
        exit(1);
    }
}

void apanel_shutdown(auxpanel_t *ap)
{
    pthread_join(ap->a_ufprocessor, NULL);
    pthread_join(ap->a_dfprocessor, NULL);
}

/*
 * UFLOW PROCESSOR FUNCTIONS
 *
 */
void *apanel_ufprocessor(void *arg) 
{
    auxpanel_t *ap = (auxpanel_t *)arg;
    dpanel_t *dp = (dpanel_t *)ap->dpanel;

    // Initialize the event loop
    ap->a_uloop = event_base_new();

    ap->a_uctx = redisAsyncConnect(ap->server, ap->port);
    if (ap->a_uctx->err)
    {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", ap->server, ap->port);
        exit(1);
    }

    redisLibeventAttach(ap->a_uctx, ap->a_uloop);
    redisAsyncSetConnectCallback(ap->a_uctx, apanel_connect_cb);
    redisAsyncSetDisconnectCallback(ap->a_uctx, apanel_disconnect_cb);

    redisAsyncCommand(ap->a_uctx, apanel_ucallback, ap, "fcall get_id 0 %s", dp->uuid);
    event_base_dispatch(ap->a_uloop);
    // the above call is blocking... so we come here after the loop has exited

    return NULL;
}

void apanel_connect_dcb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Connected...\n");
}

void apanel_disconnect_dcb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK) {
        printf("Error: %s\n", c->errstr);
        return;
    }
    printf("Disconnected...\n");
}


void apanel_ucallback(redisAsyncContext *c, void *r, void *privdata) 
{
    redisReply *reply = r;
    auxpanel_t *ap = (auxpanel_t *)privdata;
    struct queue_entry *next = NULL; 
    bool last = true;
    dpanel_t *dp = (dpanel_t *)ap->dpanel;
    cnode_t *cn = (cnode_t *)dp->cnode;
    
    if (reply == NULL) {
        if (c->errstr) {
            printf("errstr: %s\n", c->errstr);
        }
        return;
    }

    while (ap->state != A_REGISTERED && reply->integer <= 0 && ap->ecount <= DP_MAX_ERROR_COUNT) {
        // retry again... for a registration..
        ap->ecount++;
        redisAsyncCommand(ap->a_uctx, apanel_ucallback, ap, "fcall get_id 0 %s", dp->uuid);
    }

    if (ap->state != A_REGISTERED && reply->integer <= 0 && ap->ecount > DP_MAX_ERROR_COUNT) {
        fprintf(stderr, "Unable to register with the data store at %s, %d\n", ap->server, ap->port);
        exit(1);
    }

    // do registration..
    if (ap->state != A_REGISTERED) {
        if (reply->integer > 0) {
            ap->state = A_REGISTERED;
            ap->logical_id = reply->integer;
        }
    }

    // TODO: enable pipelining... for larger write throughout...
    //
    if (ap->state == A_REGISTERED) {
        // pull data from the queue
    //    next = get_uflow_object(ap, &last);
        if (next != NULL) {
            uflow_obj_t *uobj = (uflow_obj_t *)next->data;
            if (last) {
                // send with a callback
                redisAsyncCommand(ap->a_uctx, apanel_ucallback, ap, "fcall uf_write 1 %s %lu %d %d %f %f %s", uobj->key, uobj->clock, ap->logical_id, cn->width, cn->xcoord, cn->ycoord, uobj->value);
            } else {
                // send without a callback for pipelining.
                redisAsyncCommand(ap->a_uctx, apanel_ucallback, ap, "fcall uf_write 1 %s %lu %d %d %f %f %s", uobj->key, uobj->clock, ap->logical_id, cn->width, cn->xcoord, cn->ycoord, uobj->value);
            }
           // freeUObject(uobj);
            free(next);
        }
    }
}


/*
 * DFLOW PROCESSOR FUNCTIONS
 */
void *apanel_dfprocessor(void *arg) 
{
    auxpanel_t *ap = (auxpanel_t *)arg;
    // Initialize the event loop
    ap->a_dloop = event_base_new();

    ap->a_dctx = redisAsyncConnect(ap->server, ap->port);
    if (ap->a_dctx->err) {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", ap->server, ap->port);
        exit(1);
    }

    redisLibeventAttach(ap->a_dctx, ap->a_dloop);
    redisAsyncSetConnectCallback(ap->a_dctx, apanel_connect_dcb);
    redisAsyncSetDisconnectCallback(ap->a_dctx, apanel_disconnect_dcb);

   // redisAsyncCommand(ap->a_dctx, apanel_dcallback, ap, "SUBSCRIBE __d__keycompleted");
    event_base_dispatch(ap->a_dloop);
    // the above call is blocking... so we come here after the loop has exited

    return NULL;
}

// this callback is triggered when a broadcast message is sent by the data store
//
void apanel_dcallback(redisAsyncContext *c, void *r, void *privdata) 
{
    redisReply *reply = r;
    auxpanel_t *ap = (auxpanel_t *)privdata;
    dpanel_t *dp = (dpanel_t *)ap->dpanel;
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
         //   if (entry->state == BOTH_RECEIVED && entry->taskid > 0) 
           //     redisAsyncCommand(dp->dctx, dflow_callback, dp, "fcall df_lread 1 %s", entry->key);
        }
    }
}

// this is callback used by the actual reading function for the data in dflow
// so.. here we need to 
//
/*
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
*/

void apanel_send_to_fogs(arecord_t *aps, uflow_obj_t *uobj)
{
    

}
