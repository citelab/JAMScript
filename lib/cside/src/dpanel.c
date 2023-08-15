#include <stdio.h>
#include <stdbool.h>
#include <unistd.h>
#include <assert.h>
#include <string.h>
#include <inttypes.h>

#include "cnode.h"
#include "dpanel.h"
#include "tboard.h"
#include "auxpanel.h"


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

int derror;

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
    dp->logical_appid = -1;
    dp->use_apanel = false;

    assert(pthread_mutex_init(&(dp->mutex), NULL) == 0);

    assert(pthread_mutex_init(&(dp->ufmutex), NULL) == 0);
    assert(pthread_mutex_init(&(dp->dfmutex), NULL) == 0);
    assert(pthread_cond_init(&(dp->ufcond), NULL) == 0);
    assert(pthread_cond_init(&(dp->dfcond), NULL) == 0);

    dp->ufqueue = queue_create();
    queue_init(&(dp->ufqueue));

    return dp;
}

void dpanel_setcnode(dpanel_t *dp, void *cn) {
    dp->cnode = cn;
    ((cnode_t *)cn)->dpanel = dp;
}

void dpanel_settboard(dpanel_t *dp, void *tb) {
    dp->tboard = (void *)tb;
}

void dpanel_connect_cb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK)
        printf("Dpanel_connect_cb Error: %s\n", c->errstr);
}

void dpanel_disconnect_cb(const redisAsyncContext *c, int status) {
    if (status != REDIS_OK)
        printf("Dpanel_discconnect_cb Error: %s\n", c->errstr);
}

void dpanel_start(dpanel_t *dp)
{
    int rval;

    rval = pthread_create(&(dp->ufprocessor), NULL, dpanel_ufprocessor, (void *)dp);
    if (rval) {
        perror("ERROR! Unable to start the dpanel ufprocessor thread");
        exit(1);
    }

    rval = pthread_create(&(dp->dfprocessor), NULL, dpanel_dfprocessor, (void *)dp);
    if (rval) {
        perror("ERROR! Unable to start the dpanel dfprocessor thread");
        exit(1);
    }
}

void dpanel_shutdown(dpanel_t *dp)
{
    pthread_join(dp->ufprocessor, NULL);
    pthread_join(dp->dfprocessor, NULL);
}

void dpanel_add_apanel(dpanel_t *dp, char *nid, void *a)
{
    auxpanel_t *ap = (auxpanel_t *)a;

    arecord_t *arec = (arecord_t *)calloc(1, sizeof(arecord_t));
    arec->apanel = ap;
    strncpy(arec->key, nid, MAX_NAME_LEN);
    pthread_mutex_lock(&(dp->mutex));
    HASH_ADD_STR(dp->apanels, key, arec);
    dp->use_apanel = true;
    pthread_mutex_unlock(&(dp->mutex));
}

void dpanel_del_apanel(dpanel_t *dp, char *nid)
{
    arecord_t *arec;

    pthread_mutex_lock(&(dp->mutex));
    HASH_FIND_STR(dp->apanels, nid, arec);
    pthread_mutex_unlock(&(dp->mutex));
    if (arec) {
        auxpanel_t *ap = arec->apanel;
        HASH_DEL(dp->apanels, arec);
        free(arec);
        apanel_free(ap);
        apanel_shutdown(ap);
    }
    pthread_mutex_lock(&(dp->mutex));
    int cnt = HASH_COUNT(dp->apanels);
    if (cnt == 0)
        dp->use_apanel = false;
    pthread_mutex_unlock(&(dp->mutex));
}


/*
 * UFLOW PROCESSOR FUNCTIONS
 *
 */
void* dpanel_ufprocessor(void* arg)
{
    dpanel_t* dp = (dpanel_t*)arg;

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

void dpanel_connect_dcb(const redisAsyncContext* c, int status) {
    if (status != REDIS_OK)
        printf("Error: %s\n", c->errstr);
}

void dpanel_disconnect_dcb(const redisAsyncContext* c, int status) {
    if (status != REDIS_OK)
        printf("Error: %s\n", c->errstr);
}

void dpanel_uerrorcheck(redisAsyncContext* c, void* r, void* privdata) {
    if (r == NULL && c->errstr)
        printf("errstr: %s\n", c->errstr);
}

void dpanel_uaddall(dpanel_t* dp) { // add all pending uflow objects to outgoing redis queue
    struct queue_entry* next = NULL;
    bool last = false;
    cnode_t* cn = (cnode_t*)dp->cnode;
    int overrun = 100; // number of times to batch before detecting an overrun and send everything -- only relevant if we are absolutely spamming queue

    if (dp->state == REGISTERED) {
        while (!last && overrun) {
            next = get_uflow_object(dp, &last); // pull data from the queue
            if (next == NULL)
                return;
            uflow_obj_t* uobj = (uflow_obj_t*)next->data;
            pthread_mutex_lock(&(dp->mutex));
            apanel_send_to_fogs(dp->apanels, uobj);
            pthread_mutex_unlock(&(dp->mutex));
            if (last || !--overrun) {
                // send with a callback
                redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall uf_write 1 %s %" PRIu64 " %d %d %d %f %f %b", uobj->key, uobj->clock, dp->logical_id, dp->logical_appid, cn->width, cn->xcoord, cn->ycoord, (uint8_t*) uobj->value, (size_t) uobj->len);
            } else {
                // send without a callback for pipelining.
                redisAsyncCommand(dp->uctx, dpanel_uerrorcheck, NULL, "fcall uf_write 1 %s %" PRIu64 " %d %d %d %f %f %b", uobj->key, uobj->clock, dp->logical_id, dp->logical_appid, cn->width, cn->xcoord, cn->ycoord, (uint8_t*) uobj->value, (size_t) uobj->len);
            }
            freeUObject(uobj);
            free(next);
        }
    }
}

void dpanel_ucallback(redisAsyncContext* c, void* r, void* privdata) {
    redisReply* reply = r;
    dpanel_t* dp = (dpanel_t*)privdata;

    if (reply == NULL) {
        if (c->errstr)
            printf("errstr: %s\n", c->errstr);
        return;
    }

    if (dp->state != REGISTERED && reply->integer <= 0) {
        if (dp->ecount <= DP_MAX_ERROR_COUNT) { // retry again... for a registration..
            dp->ecount++;
            redisAsyncCommand(dp->uctx, dpanel_ucallback, dp, "fcall get_id 0 %s", dp->uuid);
            return;
        } else {
            fprintf(stderr, "Unable to register with the data store at %s, %d\n", dp->server, dp->port);
            exit(1);
        }
    }

    if (dp->state != REGISTERED) { // do registration..
        dp->state = REGISTERED;
        dp->logical_id = reply->integer;
    }

    if (dp->logical_appid < 0) {
        cnode_t* cn = (cnode_t*)dp->cnode;
        redisAsyncCommand(dp->uctx, dpanel_ucallback2, dp, "fcall app_id 0 %s", cn->args->appid);
    } else
        dpanel_uaddall(dp);
}


void dpanel_ucallback2(redisAsyncContext* c, void* r, void* privdata) {
    redisReply* reply = r;
    dpanel_t *dp = (dpanel_t*)privdata;

    if (reply == NULL) {
        if (c->errstr)
            printf("errstr: %s\n", c->errstr);
        return;
    }

    dp->logical_appid = reply->integer;

    dpanel_uaddall(dp);
}


/*
 * FUNCTIONS for dealing with UFLOW objects
 */

uftable_entry_t* dp_create_uflow(dpanel_t* dp, char* key, char* fmt)
{
    uftable_entry_t* uft = (uftable_entry_t*)calloc(sizeof(uftable_entry_t), 1);
    assert(uft != NULL);
    uft->key = strdup(key);
    uft->fmt = strdup(fmt);
    uft->dpanel = (void*)dp;
    uft->lclock = 0;
    HASH_ADD_STR(dp->uftable, key, uft);
    return uft;
}


struct queue_entry* get_uflow_object(dpanel_t* dp, bool* last) {
    struct queue_entry* next = NULL,* nnext;

    while (next == NULL) {
        pthread_mutex_lock(&(dp->ufmutex));
        next = queue_peek_front(&(dp->ufqueue));
        if (next) {
            queue_pop_head(&(dp->ufqueue));
            nnext = queue_peek_front(&(dp->ufqueue));
            *last = !nnext;
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

void freeUObject(uflow_obj_t* uobj) {
    free(uobj->value);
    free(uobj);
}



uflow_obj_t* uflow_obj_new(uftable_entry_t* uf, char* vstr, int len)
{
    uflow_obj_t* uo = (uflow_obj_t *)calloc(sizeof(uflow_obj_t), 1);
    uo->key = uf->key;
    uo->fmt = uf->fmt;
    dpanel_t* dp = uf->dpanel;
    cnode_t* cn = dp->cnode;
    uo->clock = get_jamclock(cn);

    uo->value = malloc(len);
    uo->len = len;
    memcpy(uo->value, vstr, len);
    return uo;
}


void ufwrite_int(uftable_entry_t* uf, int x)
{
    dpanel_t* dp = (dpanel_t*)(uf->dpanel);
    struct queue_entry* e = NULL;
    uflow_obj_t* uobj;

    uint8_t buf[16];

    CborEncoder encoder;
    cbor_encoder_init(&encoder, (uint8_t*)&buf, sizeof(buf), 0);
    cbor_encode_int(&encoder, x);

    int len = cbor_encoder_get_buffer_size(&encoder, (uint8_t*)&buf);
    uobj = uflow_obj_new(uf, (char*)buf, len);


    e = queue_new_node(uobj);
    pthread_mutex_lock(&(dp->ufmutex));
    queue_insert_tail(&(dp->ufqueue), e);
    pthread_cond_signal(&(dp->ufcond));
    pthread_mutex_unlock(&(dp->ufmutex));
}

void ufwrite_double(uftable_entry_t* uf, double x)
{
    dpanel_t* dp = (dpanel_t*)(uf->dpanel);
    struct queue_entry* e = NULL;
    uflow_obj_t* uobj;

    uint8_t buf[16];

    CborEncoder encoder;
    cbor_encoder_init(&encoder, (uint8_t*)&buf, sizeof(buf), 0);
    cbor_encode_double(&encoder, x);

    int len = cbor_encoder_get_buffer_size(&encoder, (uint8_t*)&buf);
    uobj = uflow_obj_new(uf, (char*)buf, len);

    e = queue_new_node(uobj);
    pthread_mutex_lock(&(dp->ufmutex));
    queue_insert_tail(&(dp->ufqueue), e);
    pthread_cond_signal(&(dp->ufcond));
    pthread_mutex_unlock(&(dp->ufmutex));
}


void ufwrite_str(uftable_entry_t* uf, char* str)
{
    dpanel_t* dp = (dpanel_t*)(uf->dpanel);
    struct queue_entry* e = NULL;
    uflow_obj_t* uobj;

    uint8_t buf[4096];

    CborEncoder encoder;
    cbor_encoder_init(&encoder, (uint8_t*)&buf, sizeof(buf), 0);
    cbor_encode_text_stringz(&encoder, str);

    int len = cbor_encoder_get_buffer_size(&encoder, (uint8_t*)&buf);
    uobj = uflow_obj_new(uf, (char*)buf, len);

    e = queue_new_node(uobj);
    pthread_mutex_lock(&(dp->ufmutex));
    queue_insert_tail(&(dp->ufqueue), e);
    pthread_cond_signal(&(dp->ufcond));
    pthread_mutex_unlock(&(dp->ufmutex));
}

void ufwrite_struct(uftable_entry_t* uf, char* fmt, ...)
{
    dpanel_t* dp = (dpanel_t *)(uf->dpanel);
    struct queue_entry* e = NULL;
    uflow_obj_t* uobj;
    va_list args;
    darg_t* uargs;
    char* label;
    nvoid_t* nv;

    int len = strlen(fmt);
    assert(len > 0);

    uargs = (darg_t*)calloc(len, sizeof(darg_t)); // TODO can this just be a malloc

    va_start(args, fmt);
    for (int i = 0; i < len; i++) {
        label = va_arg(args, char*);
        uargs[i].label = strdup(label);
        switch(fmt[i]) {
        case 'n': // TODO this isn't actually getting transmitted at all right now
            nv = va_arg(args, nvoid_t*); // TODO -- to clone?
            uargs[i].val.nval = nv;
            uargs[i].type = D_NVOID_TYPE;
            break;
        case 's':
            uargs[i].val.sval = strdup(va_arg(args, char*));
            uargs[i].type = D_STRING_TYPE;
            break;
        case 'i':
            uargs[i].val.ival = va_arg(args, int);
            uargs[i].type = D_INT_TYPE;
            break;
        case 'l':
            uargs[i].val.lval = va_arg(args, long long int);
            uargs[i].type = D_LONG_TYPE;
            break;
        case 'd':
            uargs[i].val.dval = va_arg(args, double);
            uargs[i].type = D_DOUBLE_TYPE;
            break;
        default:
            break;
        }
    }
    va_end(args);

    uint8_t buf[4096];

    CborEncoder encoder;
    cbor_encoder_init(&encoder, (uint8_t*)&buf, sizeof(buf), 0);
    do_cbor_encoding(&encoder, uargs, len);

    int clen = cbor_encoder_get_buffer_size(&encoder, (uint8_t*)&buf);
    uobj = uflow_obj_new(uf, (char*)buf, clen);

    free_buffer(uargs, len);
    e = queue_new_node(uobj);
    pthread_mutex_lock(&(dp->ufmutex));
    queue_insert_tail(&(dp->ufqueue), e);
    pthread_cond_signal(&(dp->ufcond));
    pthread_mutex_unlock(&(dp->ufmutex));
}


/*
 * DFLOW PROCESSOR FUNCTIONS
 */
void* dpanel_dfprocessor(void* arg)
{
    dpanel_t* dp = (dpanel_t*)arg;
    cnode_t* cn = (cnode_t*)dp->cnode;

    // Initialize the event loop
    dp->dloop = event_base_new();

    dp->dctx = redisAsyncConnect(dp->server, dp->port);
    if (dp->dctx->err) {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", dp->server, dp->port);
        exit(1);
    }
    dp->dctx2 = redisAsyncConnect(dp->server, dp->port);
    if (dp->dctx2->err) {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", dp->server, dp->port);
        exit(1);
    }

    redisLibeventAttach(dp->dctx, dp->dloop);
    redisAsyncSetConnectCallback(dp->dctx, dpanel_connect_dcb);
    redisAsyncSetDisconnectCallback(dp->dctx, dpanel_disconnect_dcb);
    redisLibeventAttach(dp->dctx2, dp->dloop);
    redisAsyncSetConnectCallback(dp->dctx2, dpanel_connect_dcb);
    redisAsyncSetDisconnectCallback(dp->dctx2, dpanel_disconnect_dcb);
    if (dp->logical_appid < 0)
        redisAsyncCommand(dp->dctx, dpanel_dcallback2, dp, "fcall app_id 0 %s", cn->args->appid);
    else
        redisAsyncCommand(dp->dctx2, dpanel_dcallback, dp, "SUBSCRIBE %d__d__keycompleted", dp->logical_appid);

    event_base_dispatch(dp->dloop);
    // the above call is blocking... so we come here after the loop has exited

    return NULL;
}


// this callback is triggered when a broadcast message is sent by the data store
//
void dpanel_dcallback2(redisAsyncContext* c, void* r, void* privdata)
{
    redisReply* reply = r;
    dpanel_t* dp = (dpanel_t*)privdata;

    if (reply == NULL) {
        if (c->errstr)
            printf("errstr: %s\n", c->errstr);
        return;
    }

    dp->logical_appid = reply->integer;

    redisAsyncCommand(dp->dctx2, dpanel_dcallback, dp, "SUBSCRIBE %d__d__keycompleted", dp->logical_appid);
}


// this callback is triggered when a broadcast message is sent by the data store
//
void dpanel_dcallback(redisAsyncContext* c, void* r, void* privdata)
{
    redisReply* reply = r;
    dpanel_t* dp = (dpanel_t*)privdata;
    dftable_entry_t* entry;

    if (reply == NULL) {
        if (c->errstr)
            printf("errstr: %s\n", c->errstr);
        return;
    }

    char keymsg[64];
    snprintf(keymsg, 64, "%d__d__keycompleted", dp->logical_appid);

    if (dp->use_apanel)
        return; // the dpanel callback disabled - using the apanel cb

    if (reply->type == REDIS_REPLY_ARRAY && (strcmp(reply->element[1]->str, keymsg) == 0) && (strcmp(reply->element[0]->str, "message") == 0)) {
        HASH_FIND_STR(dp->dftable, reply->element[2]->str, entry);
        if (entry && entry->state == CLIENT_READY && entry->taskid > 0)
            redisAsyncCommand(dp->dctx, dflow_callback, entry, "fcall df_lread 1 %s %d", entry->key, dp->logical_appid);
    }
}

// this is callback used by the actual reading function for the data in dflow
void dflow_callback(redisAsyncContext* c, void* r, void* privdata) {
    redisReply* reply = r;
    // the privdata is pointing to the dftable_entry
    dftable_entry_t* entry = (dftable_entry_t*)privdata;
    dpanel_t* dp = entry->dpanel;
    tboard_t* t = dp->tboard;
    remote_task_t* rtask = NULL;

    if (reply == NULL) {
        if (c->errstr)
            printf("errstr: %s\n", c->errstr);
        return;
    }

    HASH_FIND(hh, t->task_table, &(entry->taskid), sizeof(uint64_t), rtask);
    if (rtask != NULL) {
        if(rtask->status == DFLOW_TASK_COMPLETED)
            return;

        redisReply* cborData = (reply->element[7]);
        rtask->data = malloc(cborData->len);

        memcpy(rtask->data, cborData->str, cborData->len);
        rtask->data_size = cborData->len;
        if (rtask->calling_task != NULL) {
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
dftable_entry_t* dp_create_dflow(dpanel_t* dp, char* key, char* fmt) {
    // create the dftable_entry, mutex needs to be initialized
    dftable_entry_t* df = (dftable_entry_t*)calloc(sizeof(dftable_entry_t), 1);
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


/*
 * Value readers - these are going to block the coroutine by creating a user-level
 * context switch until the data is ready. The coroutine might still face a queuing
 * delay before getting activated. We have readers for primitive values (integer,
 * double, string, &c.) and composite values (structures). The sending side (J) is
 * pushing a JSON object with field names in the case of structures. For primitive
 * values the J side is pushing the values alone.
 */
void dfread_int(dftable_entry_t* df, int* val) {
    dpanel_t* dp = (dpanel_t*)df->dpanel;
    cnode_t* cn = (cnode_t*)dp->cnode;
    tboard_t* tboard = (tboard_t*)cn->tboard;

    dflow_task_response_t res = dflow_task_create(tboard, df);
    if (res.buf != NULL) {
        derror = 0;
        *val = __extract_int(res.buf, res.len);
        free(res.buf);
    } else {
        derror = -1;
        *val = 0;
    }
}

void dfread_double(dftable_entry_t* df, double* val) {
    dpanel_t* dp = (dpanel_t*)df->dpanel;
    cnode_t* cn = (cnode_t*)dp->cnode;
    tboard_t* tboard = (tboard_t*)cn->tboard;

    dflow_task_response_t res = dflow_task_create(tboard, df);
    if (res.buf != NULL) {
        derror = 0;
        *val = __extract_double(res.buf, res.len);
        free(res.buf);
    } else {
        derror = -1;
        *val = 0;
    }
}

void dfread_string(dftable_entry_t* df, char* val, int maxlen) {
    dpanel_t* dp = (dpanel_t*)df->dpanel;
    cnode_t* cn = (cnode_t*)dp->cnode;
    tboard_t* tboard = (tboard_t*)cn->tboard;

    dflow_task_response_t res = dflow_task_create(tboard, df);
    if (res.buf != NULL) {
        derror = 0;
        char* x = __extract_str(res.buf, res.len);
        strncpy(val, x, maxlen);
        free(x);
        free(res.buf);

    } else {
        derror = -1;
        *val = 0;
    }
}

#define DFREAD_STRUCT_STATIC_FIELD_LENGTH 32
void dfread_struct(dftable_entry_t* df, char* fmt, ...) {
    dpanel_t* dp = (dpanel_t*)df->dpanel;
    cnode_t* cn = (cnode_t*)dp->cnode;
    tboard_t* tboard = (tboard_t *)cn->tboard;

    dflow_task_response_t res = dflow_task_create(tboard, df);
    if (res.buf != NULL) {
        derror = 0;
        int len = strlen(fmt);
        assert(len > 0);
        va_list args;
        char* label;

        darg_entry_t darg_static[DFREAD_STRUCT_STATIC_FIELD_LENGTH],* darg_mem;
        darg_entry_t* dargs = NULL,* darg,* tmp;
        if (len > DFREAD_STRUCT_STATIC_FIELD_LENGTH) // try to use static allocation
            darg_mem = (darg_entry_t*)malloc(sizeof(darg_entry_t) * len);
        else
            darg_mem = darg_static;

        va_start(args, fmt);
        for(int i=0; i<len; i++){
            label = va_arg(args, char*);
            darg = &darg_mem[i];
            switch(fmt[i]){
            case 'i':
                darg->type = D_INT_TYPE;
                darg->loc.ival = va_arg(args, int*);
                break;
            case 'l':
                darg->type = D_LONG_TYPE;
                darg->loc.lval = va_arg(args, long long int*);
                break;
            case 's':
                darg->type = D_STRING_TYPE;
                darg->loc.nval = va_arg(args, nvoid_t*);
                break;
            case 'd':
                darg->type = D_DOUBLE_TYPE;
                darg->loc.dval = va_arg(args, double*);
                break;
            case 'n':
                darg->type = D_NVOID_TYPE;
                darg->loc.nval = va_arg(args, nvoid_t*);
                break;
            default:
                printf("Unrecognized format option %c for %s\n", fmt[i], label);
                va_arg(args, void*);
            }
            HASH_ADD_STR(dargs, label, darg);
        }
        va_end(args);

        __extract_map(res.buf, res.len, dargs);

        HASH_ITER(hh, dargs, darg, tmp){
            printf("CBOR had no input for struct field %s\n", darg->label);
            HASH_DEL(dargs, darg);
        }
        if (len > DFREAD_STRUCT_STATIC_FIELD_LENGTH)
            free(darg_mem);
        free(res.buf);
    } else
        derror = -1;
}
