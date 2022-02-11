/*
The MIT License (MIT)
Copyright (c)   2017 Muthucumaru Maheswaran
                2017 Yuechung Jiang
                2016-2017 Xiru Zhu

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*
    This module is based on the jdata originally written by Xiru Zhu
    with some help from Richboy Echomgbe.

    This one uses libevent and also leverages the event loop in the proper
    way. The next data item (if present) is sent into the Redis Async buffer
    only after the callback comes from the previous write.

    The earlier version was sticking the data items without waiting for the
    previous data to be enqueued. This resulted in an implementation, which failed
    when the write speed was high.
*/

#include "jamdata.h"
#include "base64.h"
#include "simplelist.h"
#include "jparser.h"
#include "json.h"


extern char app_id[64];
char dev_id[256] = { 0 };

int _count_ = 0;

//jamstate variable to be kept in reference
jamstate_t *js;

list_elem_t *jamdata_objs = NULL;
bool dispatched = false;

/*
 * This is the default connection callback.
 * This is utilized when the connection callback for jdata is not defined
 * You do not need to use this anywhere, this is only utilized in the library a default callback.
 */
void jamdata_def_connect(const redisAsyncContext *c, int status)
{
    if (status != REDIS_OK)
    {
        printf("JData Connection Error: %s\n", c->errstr);
        return;
    }
#ifdef DEBUG_LVL1
    printf("Connected... status: %d\n", status);
#endif
}

/*
 * This is the default disconnection callback.
 * This is utilized when the disconnection callback for jdata is not defined
 * You do not need to use this anywhere, this is only utilized in the library a default callback.
 */
void jamdata_def_disconnect(const redisAsyncContext *c, int status)
{
    if (status != REDIS_OK)
    {
        printf("JData Disconnection Error: %s\n", c->errstr);
        return;
    }
#ifdef DEBUG_LVL1
    printf("Disconnected...\n");
#endif
}


/*
 * This initializes the JAM Data subsystem. It never returns so it should be run
 * in its own thread. This is using the event loop to do the actual sending.
 * Only the logger functionality is handled through this function.
 */
void *jamdata_init(void *jsp)
{
    js = (jamstate_t *)jsp;

    // Initialize the event loop
    js->eloop = event_base_new();
    js->bloop = event_base_new();

    // setup the app_id and dev_id locally.
    if (strlen(app_id) == 0)
        strncpy(app_id, DEFAULT_APP_NAME, sizeof(app_id) - 1);
    strncpy(dev_id, js->cstate->device_id, sizeof(dev_id) - 1);

    // If we don't have a redis server location set.. wait
    if (js->cstate->redserver == NULL)
    #ifdef linux
        sem_wait(&js->jdsem);
    #elif __APPLE__
        sem_wait(js->jdsem);
    #endif

#ifdef linux
    sem_post(&js->jdsem);
#elif __APPLE__
    sem_post(js->jdsem);
#endif

    js->redctx = redisAsyncConnect(js->cstate->redserver, js->cstate->redport);
    if (js->redctx->err)
    {
        printf("ERROR! Connecting to the Redis server at %s:%d\n", js->cstate->redserver, js->cstate->redport);
        exit(1);
    }

    redisLibeventAttach(js->redctx, js->eloop);
    redisAsyncSetConnectCallback(js->redctx, jamdata_def_connect);
    redisAsyncSetDisconnectCallback(js->redctx, jamdata_def_disconnect);

    // Just send a test value to bootup the event loop..
    // There is no significance to this data.
    // The actual data transfer takes place in the callback entered afterwards

    char *key = jamdata_makekey("test", "s");
    __jamdata_logto_server(js->redctx, key, "dummy_value", 11, 0, jamdata_logger_cb);

    event_base_dispatch(js->eloop);

    // Don't deallocate data.. it still with the event loop..
    // Once the acknowledge is received.. the jamdata_msg_arrived callback will deallocate it

    return NULL;
}

char *jamdata_makekey(char *ns, char *lname)
{
    char format[] = "aps[%s].ns[%s].ds[%s].dts[%s]";
    char key[strlen(app_id) + strlen(ns) + strlen(lname) + strlen(dev_id) + sizeof(format) - 8];

    // create the key that we should use to write the data value
    sprintf(key, format, app_id, ns, lname, dev_id);

    return strdup(key);
}


/*
 * This is strictly an internal function. Use this function to
 * send data to the Redis..
 */
void __jamdata_logto_server(redisAsyncContext *c, char *key, char *val, size_t size, unsigned long long time_stamp, msg_rcv_callback_f callback)
{
    if (val != NULL)
    {
        redisAsyncCommand(c, callback, val, "ZADD %s %llu %b", key, time_stamp, val, size);
    }
}




void time_operation() {

    static struct timespec start;
    static int _count = 0;


    if (_count == 0)
        clock_gettime(CLOCK_MONOTONIC, &start);

    _count++;

    if (_count == 500)
    {
        struct timespec stop;
        clock_gettime(CLOCK_MONOTONIC, &stop);
        printf("Elapsed time %ld\n", ((stop.tv_sec - start.tv_sec) * 1000000L + (stop.tv_nsec - start.tv_nsec))/500);
    }
}


/*
 * This is the logger callback..
 */
void jamdata_logger_cb(redisAsyncContext *c, void *r, void *privdata)
{
    redisReply *reply = r;

    // Do error processing on the redisReply...
    if (reply == NULL)
    {

    }


    // If privdata is not NULL, release it.. it was previous data item
    if (privdata != NULL)
    {
        // TODO: Fix this memory freeing problem..
    //    free(privdata);
    }

    // Wait on the dataoutq, if it has a data item (key, value) to send
    // to the Redis.. we use the same callback..
    while (1)
    {
        nvoid_t *nv = semqueue_deq(js->dataoutq);

        if (nv != NULL)
        {
            comboptr_t *cptr = (comboptr_t *)nv->data;
            char *key = cptr->arg1;
            char *value = cptr->arg2;
            size_t size = cptr->size;
            unsigned long long time_stamp = cptr->lluarg;
            /* TODO */
            // int iscbor = cptr->iarg;
            // TODO: Free nv
            // TODO: Free memory contained in nv

            __jamdata_logto_server(js->redctx, key, value, size, time_stamp, jamdata_logger_cb);
            free(value);
            break;
        }
    }
}


//fmt - string: format string such as "%s%d%f"
//args followed fmt will be paired up. For example,
//parseCmd("%s%d", "person", "Lilly", "age", 19) indicates the variable named "person"
//is expected to have a string type value followed, which is "Lilly" in this case
comboptr_t *jamdata_encode(
    char *redis_key, 
    unsigned long long timestamp, 
    char *fmt, 
    unsigned char *buffer, 
    size_t buffer_len,
    va_list args
)
{
    int i, num = strlen(fmt);

    char *name, *s;
    int t;
    double f;

    //root   - cbor map: object contains encoded info about input args
    //content- encoded primitive type: argument's content
    //key    - encoded string: argument's name
    cbor_item_t *root = cbor_new_indefinite_map();
    cbor_item_t *iroot = cbor_new_indefinite_map();

    if (num == 0) {
        return NULL;
    }

    //fmt_str is in the format such as sdf
    for (i=0; i < num; i++)
    {
        //name of the value
        name = va_arg(args, char *);

        if (fmt[i]=='s')
        {
            s = va_arg(args, char *);
            cbor_map_add(iroot, (struct cbor_pair)
            {
                .key = cbor_move(cbor_build_string(name)),
                .value = cbor_move(cbor_build_string(s))
            }); // end of cbor_map
        }
        else
        if(fmt[i]=='i' || fmt[i]=='d')
        {
            t = abs(va_arg(args, int));
            cbor_map_add(iroot, (struct cbor_pair)
            {
                .key = cbor_move(cbor_build_string(name)),
                .value = cbor_move(cbor_build_uint32(t))
            });
        }
        else if(fmt[i]=='f')
        {
            f = va_arg(args, double);
            cbor_map_add(iroot, (struct cbor_pair)
            {
                .key = cbor_move(cbor_build_string(name)),
                .value = cbor_move(cbor_build_float8(f))
            });
        }
        else
        {
            printf("Invalid format string\n");
            return NULL;
        }
    }

    cbor_map_add(root, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("value")),
        .value = cbor_copy(iroot)
    });

    cbor_decref(&iroot);

    // Add the timestamp
    cbor_map_add(root, (struct cbor_pair)
    {
        .key = cbor_move(cbor_build_string("timestamp")),
        .value = cbor_move(cbor_build_uint64(timestamp))
    });

    cbor_serialize(root, buffer, buffer_len);

    // The cbor object itself is deallocated.
    cbor_decref(&root);

    return create_combo2llu_ptr(redis_key, buffer, buffer_len, timestamp);
}

unsigned long long ms_time() {
    struct timeval  tv;
    gettimeofday(&tv, NULL);

    // convert tv_sec & tv_usec to millisecond
    return tv.tv_sec*1000LL + tv.tv_usec/1000;
}

comboptr_t *jamdata_simple_encode(
    char *redis_key, 
    unsigned long long timestamp, 
    unsigned char *buffer, 
    size_t buffer_len,
    cbor_item_t *value
) {
    cbor_item_t *root = cbor_new_definite_map(2);

    cbor_map_add(root, (struct cbor_pair)
    {
        .key = cbor_move(cbor_build_string("value")),
        .value = cbor_move(value)
    });

    cbor_map_add(root, (struct cbor_pair)
    {
        .key = cbor_move(cbor_build_string("timestamp")),
        .value = cbor_move(cbor_build_uint64(timestamp))
    });
    int len = cbor_serialize(root, buffer, buffer_len);
    cbor_decref(&root);
    return create_combo2llu_ptr(redis_key, buffer, len, timestamp);
}


void jamdata_log_to_server_string(char *ns, char *lname, char *value) {
    unsigned long long timestamp = ms_time();
    char *key = jamdata_makekey(ns, lname);

    size_t len = 1024;
    unsigned char *buffer = (unsigned char*)malloc(len);
    comboptr_t *cptr = jamdata_simple_encode(key, timestamp, buffer, len, cbor_build_string(value));
//    free(buffer);

    semqueue_enq(js->dataoutq, cptr, sizeof(comboptr_t));
}

void jamdata_log_to_server_float(char *ns, char *lname, float value) {
    unsigned long long timestamp = ms_time();
    char *key = jamdata_makekey(ns, lname);

    size_t len = 1024;
    unsigned char *buffer = (unsigned char*)malloc(len);
    comboptr_t *cptr = jamdata_simple_encode(key, timestamp, buffer, len, cbor_build_float8(value));
 //   free(buffer);

    semqueue_enq(js->dataoutq, cptr, sizeof(comboptr_t));
}

void jamdata_log_to_server_int(char *ns, char *lname, int value) {
    unsigned long long timestamp = ms_time();
    char *key = jamdata_makekey(ns, lname);

    size_t len = 1024;
    unsigned char *buffer = (unsigned char*)malloc(len);
    comboptr_t *cptr = jamdata_simple_encode(key, timestamp, buffer, len, cbor_build_uint32(value));
 //   free(buffer);

    semqueue_enq(js->dataoutq, cptr, sizeof(comboptr_t));
}

void jamdata_log_to_server(char *ns, char *lname, char *fmt, ...)
{
    if(fmt != NULL)
    {
        unsigned long long milliseconds = ms_time();

        // char *lvalue = strdup(value);
        // Create the key
        char *key = jamdata_makekey(ns, lname);

        va_list argptr;
        va_start(argptr,fmt);

        // Create a comboptr_t using the key and value
        size_t len = 1024;
        unsigned char *buffer = (unsigned char*)malloc(len);
        comboptr_t *cptr = jamdata_encode(key, milliseconds, fmt, buffer, len, argptr);
        free(buffer);

        va_end(argptr);

        // Stick the value into the queue..
        semqueue_enq(js->dataoutq, cptr, sizeof(comboptr_t));
    }
}


//////////////////////////////////////////////////////////////////////////////////////
//      JAM BROADCASTER routines
//////////////////////////////////////////////////////////////////////////////////////

/*
 * The JAM Broadcaster design here is very inefficient. We are creating one thread for
 * each subscription. This is the quickest refactoring of the current design. The redisAsyncContext
 * does not allow across thread access (i.e., it is not thread safe!).
 * We need to develop a daemon based approach where a common daemon is responsible for all
 * activities. To do this, we need to register user-defined event handlers with the event loop.
 * One event loop will be responsible for all variables and also subscription additions (there are
 * deletions to worry about). This event loop will take the values coming from Redis and deposit
 * them in the local buffers and increment the semaphores associated with the variables.
 * We do the same thing now in separate threads.. argh!
 */


jambroadcaster_t *jambroadcaster_init(int mode, char *ns, char *varname)
{
    // Initialize the broadcaster object.
    jambroadcaster_t *jobj = create_jambroadcaster(mode, ns, varname);

    // Add it to the global list of the objects.
    if (jamdata_objs == NULL)
        jamdata_objs = create_list();

    put_list_tail(jamdata_objs, jobj, sizeof(jambroadcaster_t));

    // Return the object..
    return jobj;
}


jambroadcaster_t *create_jambroadcaster(int mode, char *ns, char *varname)
{
    jambroadcaster_t *jval;

    // Allocate the object..
    jval = (jambroadcaster_t *)calloc(1, sizeof(jambroadcaster_t));
    char format[] = "aps[%s].ns[%s].bcasts[%s]";
    char key[strlen(app_id) + strlen(ns) + strlen(varname) + sizeof format - 6];
    sprintf(key, format, app_id, ns, varname);

    jval->mode = mode;
    jval->key = strdup(key);
    jval->data = create_list();
    jval->readysem = threadsem_new();
    jval->dataq = pqueue_new(true);

    // Start the runner
    pthread_create(&(jval->thread), NULL, jambcast_runner, jval);
    task_wait(jval->readysem);

    // Return the object;
    return jval;
}


// TODO: Fix the last vs next mode
char *get_bcast_value(jambroadcaster_t *bcast)
{
    return get_bcast_next_value(bcast);
}


int get_bcast_int(char *msg)
{
    init_parse(msg);
    parse_value();
    JSONValue *jval = get_value();
    JSONValue *jjval = query_value(jval, "s", "message");

    return jjval->val.ival;
}


float get_bcast_float(char *msg)
{
    init_parse(msg);
    parse_value();
    JSONValue *jval = get_value();
    JSONValue *jjval = query_value(jval, "s", "message");

    return (float)jjval->val.dval;

}

char *get_bcast_char(char *msg)
{
    init_parse(msg);
    parse_value();
    JSONValue *jval = get_value();
    JSONValue *jjval = query_value(jval, "s", "message");

    return jjval->val.sval;
}


char *get_bcast_next_value(jambroadcaster_t *bcast)
{
    char *dval;

    nvoid_t *nv = pqueue_deq(bcast->dataq);
    if (nv != NULL)
    {
        dval = (char *)nv->data;
        free(nv);

        return dval;
    }

    return NULL;
}



// TODO: Reimplement this one with the new design
//
// char *get_bcast_last_value(jambroadcaster_t *bcast)
// {
//     int count = get_bcast_count(bcast) -1;
//     for (int i = 0; i < count; i++)
//         get_bcast_next_value(bcast);
//
//     return get_bcast_next_value(bcast);
// }


// data          - encoded cbor data to be decoded
// num           - # field in data
// buffer        - a pointer to the c struct stores decoded data
// args followed - offset of each field in data
void* jamdata_decode(char *fmt, char *data, int num, void *buffer, ...)
{
    int i;

    // This is an anomalous situation.. should we flag an error?
    if (strlen(data) == 0)
        return NULL;

    struct cbor_load_result result;
    char *obuf = calloc(strlen(data), sizeof(char));
    int olen = Base64decode(obuf, data);
    cbor_item_t *obj = cbor_load((unsigned char *)obuf, olen, &result);

    // This is a debug
    //    cbor_describe(obj, stdout);

    va_list args;
    va_start(args, buffer);
    // memcpy each field value in data to the corresponding field in buffer

    struct cbor_pair *handle = cbor_map_handle(obj);
    char *s, type;
    int n;
    float f;
    int offset;

    for(i = 0; i < num; i++)
    {
        type = fmt[i];
        offset = va_arg(args, size_t);
        if(type == 's')
        {
            //string
            s = cbor_get_string(handle[i].value);
            s = strdup(s);
            memcpy(buffer+offset, &s, sizeof(char *));
        }
        else if ((type == 'd') || (type == 'i'))
        {
            n = cbor_get_integer(handle[i].value);
            memcpy(buffer+offset, &n, sizeof(int));
        }
        else if(type == 'f')
        {
            f = cbor_float_get_float(handle[i].value);
            memcpy(buffer+offset, &f, sizeof(float));
        }
        else
        {
            printf("ERROR! Invalid format string\n");
            return NULL;
        }
    }
    return buffer;
}


// One connection for each broadcaster...?
// TODO: Is this efficient?
//
void *jambcast_runner(void *arg)
{
    jambroadcaster_t *jval = arg;

    // Wait if there is no redserver -
    // There could be a potential race here - a 'break' between if - taskwait
    // We avoid it here - because we are only using this 'one shot'
    //
    if (js->cstate->redserver == NULL)
    #ifdef linux
        sem_wait(&js->jdsem);
    #elif __APPLE__
        sem_wait(js->jdsem);
    #endif
#ifdef linux
    sem_post(&js->jdsem);
#elif __APPLE__
    sem_post(js->jdsem);
#endif

    //Create new context for the jdata. One unique connection for each variable.
    jval->redctx = redisAsyncConnect(js->cstate->redserver, js->cstate->redport);
    if (jval->redctx->err) {
        printf("ERROR: %s\n", jval->redctx->errstr);
        return NULL;
    }

    redisAsyncSetConnectCallback(jval->redctx, jamdata_def_connect);
    redisAsyncSetDisconnectCallback(jval->redctx, jamdata_def_disconnect);

    redisLibeventAttach(jval->redctx, js->bloop);

    redisAsyncCommand(jval->redctx, jambcast_recv_callback, jval, "SUBSCRIBE %s", jval->key);
    if (!dispatched)
    {
        dispatched = true;
        thread_signal(jval->readysem);
        event_base_dispatch(js->bloop);
    }
    else
        thread_signal(jval->readysem);

    // We should not reach here!
    return NULL;
}


void jambcast_recv_callback(redisAsyncContext *c, void *r, void *privdata)
{
    jambroadcaster_t *jval = privdata;
    redisReply *reply = r;
    char *result;
    char *varname;

    if (reply == NULL)
    {
        printf("ERROR! Null reply from Redis...\n");
        return;
    }
    if (reply->type == REDIS_REPLY_ARRAY)
    {
        varname = reply->element[1]->str;
        result = reply->element[2]->str;

        if ((result != NULL) && (strcmp(varname, jval->key) == 0))
            pqueue_enq(jval->dataq, result, strlen(result));
    }
}
