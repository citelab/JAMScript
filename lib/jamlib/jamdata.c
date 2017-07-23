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

extern char app_id[256];
char dev_id[256] = { 0 };

//jamstate variable to be kept in reference
jamstate_t *js;

//For sync calls to logger.
redisContext *jdata_sync_context;

//Linked List System for current jdata elements.
//This is because we need to look up which jdata is updated
jdata_list_node *jdata_list_head = NULL;
jdata_list_node *jdata_list_tail = NULL;


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
    printf("Connected...\n");
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
    // Do we have a server location set for Redis?
    if (js->cstate->redserver != NULL && js->cstate->redport != 0)
    {
        js->redctx = redisAsyncConnect(js->cstate->redserver, js->cstate->redport);
        if (js->redctx->err)
        {
            printf("ERROR! Connecting to the Redis server at %s:%d\n", js->cstate->redserver, js->cstate->redport);
            exit(1);
        }
    }
    else
    {
        printf("ERROR! Redis server location unknown. Failed to initialize JAM data\n");
        printf("Exiting...\n\n");
        exit(1);
    }

    // setup the app_id and dev_id locally.
    if (strlen(app_id) == 0)
        strncpy(app_id, DEFAULT_APP_NAME, sizeof(app_id) - 1);
    strncpy(dev_id, js->cstate->device_id, sizeof(dev_id) - 1);


    redisLibeventAttach(js->redctx, js->eloop);
    redisAsyncSetConnectCallback(js->redctx, jamdata_def_connect);
    redisAsyncSetDisconnectCallback(js->redctx, jamdata_def_disconnect);

    // Just send a test value to bootup the event loop..
    // There is no significance to this data.
    // The actual data transfer takes place in the callback entered afterwards
    char *key = jamdata_makekey("test", "s");
    __jamdata_logto_server(js->redctx, key, "dummy_value", jamdata_logger_cb, 0);
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
void __jamdata_logto_server(redisAsyncContext *c, char *key, char *val, msg_rcv_callback callback, int iscbor)
{
    if (val != NULL)
    {
        if (iscbor)
            redisAsyncCommand(c, callback, val, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                local t = (redis.call('TIME'))[1]; \
                                                local insert_order =  redis.call('ZCARD', KEYS[1]) + 1; \
                                                redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t .. \"$$$\" .. \"cbor\"); \
                                                return {t}", key, val);
        else
            redisAsyncCommand(c, callback, val, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                local t = (redis.call('TIME'))[1]; \
                                                local insert_order =  redis.call('ZCARD', KEYS[1]) + 1; \
                                                redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t); \
                                                return {t}", key, val);
    }
}


/*
 * This is the logger callback..
 */
void jamdata_logger_cb(redisAsyncContext *c, void *reply, void *privdata)
{
    redisReply *r = reply;

    printf("JAMData logger callback..\n");

    // Do error processing on the redisReply...
    if (reply == NULL)
    {

    }


    // If privdata is not NULL, release it.. it was previous data item
    if (privdata != NULL)
    {
        printf("Releasing. memory \n");
        // TODO: Fix this memory freeing problem..
    //    free(privdata);
        printf("Done....\n");
    }

    if (js != NULL)
        printf("JAMScript Not NULL.... devid %s\n", js->cstate->device_id);


    // Wait on the dataoutq, if it has a data item (key, value) to send
    // to the Redis.. we use the same callback..
    while (1)
    {
        printf("Trying dequeue... %s\n", js->dataoutq->queue->name);
        nvoid_t *nv = semqueue_deq(js->dataoutq);
        printf("Dequeued......\n");

        if (nv != NULL)
        {
            comboptr_t *cptr = (comboptr_t *)nv->data;
            char *key = cptr->arg1;
            char *value = cptr->arg2;
            int iscbor = cptr->iarg;
            // TODO: Free nv

            __jamdata_logto_server(js->redctx, key, value, jamdata_logger_cb, iscbor);
            break;
        }
    }
}


//fmt - string: format string such as "%s%d%f"
//args followed fmt will be paired up. For example,
//parseCmd("%s%d", "person", "Lilly", "age", 19) indicates the variable named "person"
//is expected to have a string type value followed, which is "Lilly" in this case
char *jamdata_encode(char *fmt, ...)
{
    uint8_t *buffer;
    size_t len;
    int i, num = strlen(fmt);

    if (num==0) return NULL;

    //root   - cbor map: object contains encoded info about input args
    //content- encoded primitive type: argument's content
    //key    - encoded string: argument's name
    cbor_item_t *root = cbor_new_indefinite_map();

    //initialize args to be used by va_end and va_arg
    va_list args;
    va_start(args, fmt);

    char *name, *s;
    int t;
    double f;

    //fmt_str is in the format such as sdf
    for (i=0; i < num; i++)
    {
        //name of the value
        name = va_arg(args, char *);

        if (fmt[i]=='s')
        {
            s = va_arg(args, char *);
            cbor_map_add(root, (struct cbor_pair)
            {
                .key = cbor_move(cbor_build_string(name)),
                .value = cbor_move(cbor_build_string(s))
            }); // end of cbor_map
        }
        else
        if(fmt[i]=='i' || fmt[i]=='d')
        {
            t = abs(va_arg(args, int));
            cbor_map_add(root, (struct cbor_pair)
            {
                .key = cbor_move(cbor_build_string(name)),
                .value = cbor_move(cbor_build_uint32(t))
            });
        }
        else if(fmt[i]=='f')
        {
            f = va_arg(args, double);
            cbor_map_add(root, (struct cbor_pair)
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
    va_end(args);

    cbor_serialize_alloc(root, &buffer, &len);
    char *obuf = calloc(len * 1.5, sizeof(char));
    int olen = Base64encode(obuf, buffer, len);

    // The cbor object itself is deallocated.
    cbor_decref(&root);
    return obuf;
}



void jamdata_log_to_server(char *ns, char *lname, char *value, int iscbor)
{
    if(value != NULL)
    {
        // Create the key
        char *key = jamdata_makekey(ns, lname);

        // Create a comboptr_t using the key and value
        comboptr_t *cptr = create_combo3i_ptr(key, value, NULL, iscbor);

        // Stick the value into the queue..
        semqueue_enq(js->dataoutq, cptr, sizeof(comboptr_t));
    }
}


// data          - encoded cbor data to be decoded
// num           - # field in data
// buffer        - a pointer to the c struct stores decoded data
// args followed - offset of each field in data
void* jamdata_decode(char *fmt, char *data, int num, void *buffer, ...)
{
    int i;

    struct cbor_load_result result;
    char *obuf = calloc(strlen(data), sizeof(char));
    int olen = Base64decode(obuf, data);
    cbor_item_t *obj = cbor_load(obuf, olen, &result);

    va_list args;
    va_start(args, buffer);
    // memcpy each field value in data to the corresponding field in buffer

    cbor_describe(obj, stdout);

    struct cbor_pair *handle = cbor_map_handle(obj);
    char *s, type;
    int n;
    float f;

    for(i=0;i<num;i++)
    {
        type = fmt[i];
        if(type == 's')
        {
            //string
            s = cbor_get_string(handle[i].value);
            memcpy(buffer+(va_arg(args, size_t)), s, strlen(s)+1);
            printf("%s\n", s);
        }
        else if(type == 'd')
        {
            n = cbor_get_integer(handle[i].value);
            memcpy(buffer+(va_arg(args, size_t)), &n, sizeof(int));
            printf("%d\n", n);
        }
        else if(type == 'f')
        {
            f = cbor_float_get_float8(handle[i].value);
            memcpy(buffer+(va_arg(args, size_t)), &f, sizeof(float));
            printf("%f\n", f);
        }
        else
        {
            printf("Invalid format string\n");
            return NULL;
        }
    }
    return buffer;
}


/*
 * jdata function to subscribe to a value
 * This function should be called when we want to subscribe a value. That way, when the value is updated from somewhere else,
 * the jdata gets notified about it.
 * This function is utilized by jbroadcaster which receives the data on the c side while the logger logs on the c side.
 *
 * Inputs
 *  key -> The jdata variable name
 *  value -> the value to be removed
 *  on_msg -> the callback function if you want a custom callback to do something when someone logs into that jdata
 *  connect -> the callback function if you want a custom callback for checking the connection. Can inform when connect attempt fails.
 *  disconnect -> the callback function if you want a custom callback to notify for disconnections.
 *
 * Returns the context c, which should be saved when we free the jdata value.
 */
redisAsyncContext *jamdata_subscribe_to_server(char *key, msg_rcv_callback on_msg, connection_callback connect, connection_callback disconnect)
{
    char cmd[512];

    //Create new context for the jdata. One unique connection for each variable.
    redisAsyncContext *c = redisAsyncConnect(js->cstate->redserver, js->cstate->redport);
    if (c->err) {
        printf("error: %s\n", c->errstr);
        return NULL;
    }
    redisAsyncSetConnectCallback(c, connect);
    redisAsyncSetDisconnectCallback(c, disconnect);
    redisLibeventAttach(c, js->eloop);

    redisAsyncCommand(c, on_msg, NULL, "SUBSCRIBE %s", key);

#ifdef DEBUG_LVL1
    printf("Subscribe executed...\n");
#endif

    return c;
}


/*
 * Function to free jbroadcaster variable.
 * Removes it also from the jdata linked list kept in memory
 *
 */
void free_jbroadcaster(jbroadcaster *j)
{
  //To do
  jdata_list_node *k;
  for(jdata_list_node *i = jdata_list_head; i != NULL;){
    k = i;
    i = i->next;
    if(i->data.jbroadcaster_data == j){
      k->next = i->next;
      free(i);
      break;
    }
  }
  free(j->data);
  threadsem_free(j->write_sem);
  free(j->key);
  free(j);
}


jbroadcaster *jambroadcaster_init(int type, char *namespace, char *broadcaster_name, activitycallback_f usr_callback)
{
  char format[] = "aps[%s].ns[%s].bcasts[%s]";
  char key[strlen(app_id) + strlen(namespace) + strlen(broadcaster_name) + sizeof format - 6];
  sprintf(key, format, app_id, namespace, broadcaster_name, dev_id);
  return jbroadcaster_init(type, key, usr_callback);
}

/*
Initializes a jbroadcaster. This specific variable is what receives values on the c side.
Should be utilized when declaring a jbroadcaster
Input:
    type => type of the jbroadcaster. Currently supports int, string, float
            Though the data will always be in string format and must be converted at a later time.
            This is due to redis limitation being only able to store strings.
    variable_name => name of the jbroadcaster, must be unique unfortunately.
            With jbroadcaster, you cannot shadow a jdata variable name.
    activitycallback_f => callback for when a broadcast is received.
            What you would like the program to do in such case.
*/
jbroadcaster *jbroadcaster_init(int type, char *variable_name, activitycallback_f usr_callback)
{
  jbroadcaster *ret;
  char buf[256];
  switch(type){
    case JBROADCAST_INT: break;
    case JBROADCAST_STRING: break;
    case JBROADCAST_FLOAT: break;
    default:
      printf("Invalid type...\n");
      return NULL;
  }
  ret = (jbroadcaster *)calloc(1, sizeof(jbroadcaster));
  ret->type = type;
  ret->write_sem = threadsem_new();
  ret->data = NULL;
  ret->key = strdup(variable_name);
  if(usr_callback == NULL){
    ret->usr_callback = msg_rcv_usr_callback;
  }else{
    ret->usr_callback = usr_callback;
  }

#ifdef linux
  sem_init(&ret->lock, 0, 1);
#elif __APPLE__
  sem_unlink("/jbroadcaster-sem");
  ret->lock = sem_open("/jbroadcaster-sem", O_CREAT, 0644, 1);
#endif

  //Now we need to add it to the list
  if(jdata_list_head == NULL){
    jdata_list_head = (jdata_list_node *)calloc(1, sizeof(jdata_list_node));
    jdata_list_head->data.jbroadcaster_data = ret;
    jdata_list_tail = jdata_list_head;
    jdata_list_tail->next = NULL;
  }else{
    jdata_list_tail->next = (jdata_list_node *)calloc(1, sizeof(jdata_list_node));
    jdata_list_tail = jdata_list_tail->next;
    jdata_list_tail->data.jbroadcaster_data = ret;
    jdata_list_tail->next = NULL;
  }
  ret->context = jamdata_subscribe_to_server( variable_name, jbroadcaster_msg_rcv_callback, NULL, NULL);

  // sprintf(buf, "jbroadcast_func_%s", variable_name);

  //IMPORTANT
  //REGISTERS the usercallback as a jasync callback to be called.
  //This allows us to call the user defined callbacks for jbroadcaster
 // activity_regcallback(j_s->atable, buf, ASYNC, "v", ret->usr_callback);
  return ret;
}

void msg_rcv_usr_callback(void *ten, void *arg)
{
    printf("This was activated ... \n");
    command_t *cmd = (command_t *)arg;
    jbroadcaster *x = (jbroadcaster *)cmd->args[0].val.nval;
    printf("\n-------------------\nReceived: %s\n-------------------\n", (char *)x->data);
}

void jbroadcast_set_callback(jbroadcaster *jb, activitycallback_f usr_callback)
{
  jb->usr_callback = usr_callback;
}
/*
 * The jbroadcaster callback that we utilize to process broadcasts.
 * This should not be called outside of this library.
 * Now, the problem is that this function is run in a separate thread from the main activity thread.
 * Thus we have to insert such callback activity in the main activity thread rather than simply running it here.
 * In this function, we simply return the most up to date jbroadcast value.
 * We do not save older values.
*/
void jbroadcaster_msg_rcv_callback(redisAsyncContext *c, void *reply, void *privdata)
{
    redisReply *r = reply;
    char *result;
    char *var_name;
    char buf[256];
    #ifdef DEBUG_LVL1
        printf("Jbroadcast received ...\n");
    #endif
    if (reply == NULL) return;
    if (r->type == REDIS_REPLY_ARRAY)
    {
        var_name = r->element[1]->str;
        result = r->element[2]->str;
        printf("Varname %s, result %s\n", var_name, result);

        if(result != NULL)
        {
            for(jdata_list_node *i = jdata_list_head; i != NULL; i = i->next)
            {
                if(strcmp(i->data.jbroadcaster_data->key, var_name) == 0)
                {
                    result = strdup(result);

    #ifdef linux
                    sem_wait(&i->data.jbroadcaster_data->lock);
    #elif __APPLE__
                    sem_wait(i->data.jbroadcaster_data->lock);
    #endif
                    void *to_free = i->data.jbroadcaster_data->data;
                    i->data.jbroadcaster_data->data = result;

    #ifdef linux
                    sem_post(&i->data.jbroadcaster_data->lock);
    #elif __APPLE__
                    sem_post(i->data.jbroadcaster_data->lock);
    #endif
                    free(to_free);
                    if(i->data.jbroadcaster_data->usr_callback != NULL)
                    {
                        //So here instead of executing this function here, we need to insert this into the work queue
                        sprintf(buf, "jbroadcast_func_%s", i->data.jbroadcaster_data->key);
                        //Here, we defined a unique REXEC-JDATA to signal a jdata callback that needs to be executed.
                      //   sem_wait(i->data.jbroadcaster_data->lock);
                        //command_t *rcmd = command_new("REXEC-ASY", "ASY", "-", 0, buf, "__", "0", "p", i->data.jbroadcaster_data);
                       // sem_post(i->data.jbroadcaster_data->lock);
                      //  p2queue_enq_low(j_s->atable->globalinq, rcmd, sizeof(command_t));
                    }
                    return;
                }
            }
            printf("Variable not found ... \n");
        }
    }
}


//Returns the last updated jbroadcast value given a jbroadcaster.
void *get_jambroadcaster_value(jbroadcaster *j)
{
  if(j->data == NULL)
  {
    printf("Null get attempt ...\n");
    return "00";
  }
  //assert(j->data != NULL);
  return j->data;
}
