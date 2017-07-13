/*
 * Author: Xiru Zhu
 * Date: July 4 2016
 * Updated: Jan 6 2017
 * 
 * Notes:
 *  To initialize this system,
 *  create a separate pthread and then run jdata_event_loop
 *  This should initialize jdata system. 
 * 
 * Modified to work with MacOS (CFRunLoop) - Mahesh (April 7, 2017)
 */
#include "jdata.h"

extern char app_id[256];
char dev_id[256] = { 0 };

//redis server connection parameters
char *redis_serv_IP;
int redis_serv_port;

//jamstate variable to be kept in reference
jamstate_t *j_s;

//For Async calls to logger. 
redisAsyncContext *jdata_async_context;

//For sync calls to logger. 
redisContext *jdata_sync_context;

//Event Loop. This responds to messages
struct event_base *base;
#ifdef __APPLE__
CFRunLoopRef loop;
#endif

//Linked List System for current jdata elements. 
//This is because we need to look up which jdata is updated
jdata_list_node *jdata_list_head = NULL;
jdata_list_node *jdata_list_tail = NULL;

/*
Function to initialize values and attach them to the event loop
Inputs
    jamstate
    redis server ip
    redis server port
*/
void jdata_attach(jamstate_t *js, char *serv_ip, int serv_port)
{
    if (app_id[0] == '\0') 
    {
        strncpy(app_id, DEFAULT_APP_NAME, sizeof app_id - 1);
    }
    strncpy(dev_id, js->cstate->device_id, sizeof dev_id - 1);
    //These are the initial redis server numbers. 
  
    redis_serv_IP = strdup(serv_ip);
    redis_serv_port = serv_port; //Default Port Number

    //Initialize an async context
    jdata_async_context = redisAsyncConnect(redis_serv_IP, redis_serv_port);
    if (jdata_async_context->err) {
        printf("Error: %s\n", jdata_async_context->errstr);
    }


#ifdef linux
    //Initialize event base
    base = event_base_new();
    //Attach async context to base
    redisLibeventAttach(jdata_async_context, base);   

    redisAsyncSetConnectCallback(jdata_async_context, jdata_default_connection);
    redisAsyncSetDisconnectCallback(jdata_async_context, jdata_default_disconnection);
#elif __APPLE__

    redisAsyncSetConnectCallback(jdata_async_context, jdata_default_connection);
    redisAsyncSetDisconnectCallback(jdata_async_context, jdata_default_disconnection);
    loop = CFRunLoopGetCurrent();
    if (!loop) 
    {
        printf("Error: Cannot get current run loop\n");
    }
    redisMacOSAttach(jdata_async_context, loop);
#endif

    //Initialize sync context
    struct timeval timeout = { 10, 500000 }; // Sync timeout time
    //Initialize sync context
    jdata_sync_context = redisConnectWithTimeout(redis_serv_IP, redis_serv_port, timeout);
    if (jdata_sync_context == NULL || jdata_sync_context->err) 
    {
        if (jdata_sync_context) 
        {
            printf("JData Sync Connection error: %s\n", jdata_sync_context->errstr);
            redisFree(jdata_sync_context);
        } else 
        {
            printf("JData Sync Connection error: can't allocate redis context\n");
        }
    }
}

/*
Initializes jdata system 
This has to be run in a separate thread otherwise will block the current thread. 
This thread created as to be pthread, otherwise will block all other process. 
Input:
    jamstate
*/
void *jdata_init(void *js)
{
    j_s = (jamstate_t *)js;
    jdata_attach((jamstate_t *)js, DEFAULT_SERV_IP, DEFAULT_SERV_PORT);
#ifdef DEBUG_LVL1
    printf("JData initialized...\n");
#endif
    thread_signal(j_s->jdata_sem); 
#ifdef linux
    event_base_dispatch(base);
#endif
#ifdef __APPLE__
    CFRunLoopRun();
#endif
    
    return NULL;
}

/*
 * This is the default connection callback. 
 * This is utilized when the connection callback for jdata is not defined
 * You do not need to use this anywhere, this is only utilized in the library a default callback. 
 */
void jdata_default_connection(const redisAsyncContext *c, int status) {
  if (status != REDIS_OK) {
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
void jdata_default_disconnection(const redisAsyncContext *c, int status) {
  if (status != REDIS_OK) {
      printf("JData Disconnection Error: %s\n", c->errstr);
      return;
  }
  #ifdef DEBUG_LVL1
    printf("Disconnected...\n");
  #endif
}

/*
 * This is the default jdata received callback. 
 * This is utilized when a jdata is called but no callback was assigned. It will simply print the value. 
 * You do not need to use this anywhere, this is only utilized in the library as a default callback. 
 */
void jdata_default_msg_received(redisAsyncContext *c, void *reply, void *privdata) {
  redisReply *r = reply;

  printf("Default message from REDIS...\n");

  if (reply == NULL) return;
  if (r->type == REDIS_REPLY_ARRAY) {
      for (int j = 0; j < r->elements; j++) {
          printf("%u) %s\n", j, r->element[j]->str);
      }
  }else if(r->type == REDIS_REPLY_ERROR){
    printf("%s\n", r->str);
  }else{
    printf("BUGS .... \n");
  }
    #ifdef DEBUG_LVL1
    printf("Broadcast received...\n");
  #endif
}

//fmt - string: format string such as "%s%d%f"
//args followed fmt will be paired up. For example, 
//parseCmd("%s%d", "person", "Lilly", "age", 19) indicates the variable named "person"
//is expected to have a string type value followed, which is "Lilly" in this case 
char* jamdata_encode(char *fmt, ...){
  int i, num = strlen(fmt);
  if(num==0) return NULL;

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
  for(i=0;i<num;i++){
    //name of the value
    name = va_arg(args, char *);

    if(fmt[i]=='s'){
      s = va_arg(args, char *);
      cbor_map_add(root, (struct cbor_pair){
        .key = cbor_move(cbor_build_string(name)),
        .value = cbor_move(cbor_build_string(s))
      }); 
    } 
    else if(fmt[i]=='i' || fmt[i]=='d'){
      t = abs(va_arg(args, int));
      cbor_map_add(root, (struct cbor_pair){
        .key = cbor_move(cbor_build_string(name)),
        .value = cbor_move(cbor_build_uint32(t))
      }); 
    }
    else if(fmt[i]=='f'){
      f = va_arg(args, double);
      cbor_map_add(root, (struct cbor_pair){
        .key = cbor_move(cbor_build_string(name)),
        .value = cbor_move(cbor_build_float8(f))
      }); 
    }
    else{
      printf("Invalid format string\n");
      return NULL;  
    }
  }  
  va_end(args);

  unsigned char *buffer; 
  size_t buffer_size, len = cbor_serialize_alloc(root, &buffer, &buffer_size);

  char *dump = (char *)malloc(len*2+2);
  for(i=0;i<len;i++){
    sprintf(dump+2*i, "%02X", buffer[i]);
  }
  sprintf(dump+2*i, "%02X", '\0');

  cbor_decref(&root);
  free(buffer);
  return dump;
}

// data          - encoded cbor data to be decoded
// num           - # field in data
// buffer        - a pointer to the c struct stores decoded data
// args followed - offset of each field in data
void* jamdata_decode(char *fmt, unsigned char *data, int num, void *buffer, ...){
  // convert data to char array
  int len=0, i;
  while(data[len] != '\0'){
    len++;
  }
  
  va_list args;
  va_start(args, buffer);
  // memcpy each field value in data to the corresponding field in buffer
  struct cbor_load_result result;
  cbor_item_t *obj = cbor_load(data, len, &result);
  printf("obj:\n");
  cbor_describe(obj, stdout);

  struct cbor_pair *handle = cbor_map_handle(obj);
  char *s, type; int n; float f;
  for(i=0;i<num;i++){
    type = fmt[i];       
    if(type == 's'){
      //string  
      s = cbor_get_string(handle[i].value);
      memcpy(buffer+(va_arg(args, size_t)), s, strlen(s)+1);
      printf("%s\n", s);
    } 
    else if(type == 'd'){
      n = cbor_get_integer(handle[i].value);
      memcpy(buffer+(va_arg(args, size_t)), &n, sizeof(int));
      printf("%d\n", n);
    }
    else if(type == 'f'){
      f = cbor_float_get_float8(handle[i].value);
      memcpy(buffer+(va_arg(args, size_t)), &f, sizeof(float));
      printf("%f\n", f);
    }
    else{
      printf("Invalid format string\n");
      return NULL;  
    }       
  } 
  return buffer;
}

void jamdata_log_to_server(char *namespace, char *logger_name, char *value, msg_rcv_callback callback)
{
  printf("Calling... jamdata_log\n");
  if(value != NULL){
    char format[] = "apps[%s].namespaces[%s].datasources[%s].datastreams[%s]";
    char key[strlen(app_id) + strlen(namespace) + strlen(logger_name) + strlen(dev_id) + sizeof format - 8];
    sprintf(key, format, app_id, namespace, logger_name, dev_id);
    jdata_log_to_server(key, value, callback);
    perror("After jdata");
  }
  else printf("Empty data\n"); 
}

/*
 * jdata function to log to server.
 * requires jdata to have been initialized first. Otherwise will segfault. 
 * 
 * Inputs 
 *  key -> The jdata variable name 
 *  value -> the value to be logged
 *  callback -> the callback function if you want a custom callback to signal when a log succeeds. 
                        Can be null
 * jdata grade = 'A'
 * -> jdata_log_to_server("grade", 'A', null);
 */
void jdata_log_to_server(char *key, char *value, msg_rcv_callback callback){
  
  if(callback == NULL) callback = jdata_default_msg_received;

  int length = strlen(value) + strlen(DELIM) + strlen(app_id) + strlen(DELIM) + 10;
  char newValue[length];
  sprintf(newValue , "%s%s%s", value, DELIM, app_id);
  perror("Before");
  int rack = redisAsyncCommand(jdata_async_context, callback, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                          local t = (redis.call('TIME'))[1]; \
                                                          local insert_order =  redis.call('ZCARD', KEYS[1]) + 1; \
                                                          redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t); \
                                                          return {t}", key, newValue);
  #ifdef DEBUG_LVL1
  //  printf("Logging executed... %d\n", rack);
    perror("Logger...");
  #endif
}
/*
 * jdata function to remove a logged value in redis.
 * requires jdata to have been initialized first. Otherwise will segfault. 
 * 
 * Inputs command_new
 *  key -> The jdata variable name 
 *  value -> the value to be removed
 *  callback -> the callback function if you want a custom callback to signal when a delete succeeds. 
                        Can be null
 * jdata grade = 'A'
 * jdata grade = 'B'
 *
 * This is something you can do if you don't want people seeing the 'A' value in the logs
 * -> jdata_log_to_server("grade", 'A', null)
 * -> jdata_remove_element("grade", 'A', null);
 * -> jdata_log_to_server("grade", 'B', null)
 */
void jdata_remove_element(char *key, char *value, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;  
  redisAsyncCommand(jdata_async_context, callback, NULL, "ZREM %s %s", key, value);
  #ifdef DEBUG_LVL1
    printf("Element Removed...\n");
  #endif
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
redisAsyncContext *jdata_subscribe_to_server(char *key, msg_rcv_callback on_msg, connection_callback connect, connection_callback disconnect)
{
    char cmd[512];

    //Create new context for the jdata. One unique connection for each variable. 
    redisAsyncContext *c = redisAsyncConnect(redis_serv_IP, redis_serv_port);
    if (c->err) {
        printf("error: %s\n", c->errstr);
        return NULL;
    }
    if(connect != NULL)
        redisAsyncSetConnectCallback(c, connect);
    else
        redisAsyncSetConnectCallback(c, jdata_default_connection);
    if(disconnect != NULL)
        redisAsyncSetDisconnectCallback(c, disconnect);
    else
        redisAsyncSetConnectCallback(c, jdata_default_disconnection);

#ifdef linux
    redisLibeventAttach(c, base);
#endif
#ifdef __APPLE__
    int x = redisMacOSAttach(c, loop);
    printf("X = %d\n", x);
#endif

    if(on_msg == NULL)
        on_msg = jdata_default_msg_received;
    
    sprintf(cmd, "SUBSCRIBE %s", key);
    redisAsyncCommand(c, on_msg, NULL, cmd);

#ifdef DEBUG_LVL1
    printf("Subscribe executed...\n");
#endif

    return c;
}

/*
Helper function for running custom async commands on redis. 
*/
void jdata_run_async_cmd(char *cmd, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;
  redisAsyncCommand(jdata_async_context, callback, NULL, cmd);
  #ifdef DEBUG_LVL1
    printf("Async Command Run...\n");
  #endif
}

/*
Helper function for running custom async commands on redis. 
*/
redisReply *jdata_run_sync_cmd(char *cmd){
  redisReply * ret = redisCommand(jdata_sync_context, cmd);
  if(ret == NULL){
    printf("Error, NULL return....");
  }
  #ifdef DEBUG_LVL1
    printf("Sync Command Run...\n");
  #endif
  return ret;
}

/*
 * Function to free jbroadcaster variable. 
 * Removes it also from the jdata linked list kept in memory
 * 
 */
void free_jbroadcaster(jbroadcaster *j){
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
  char format[] = "apps[%s].namespaces[%s].broadcasters[%s]";
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
jbroadcaster *jbroadcaster_init(int type, char *variable_name, activitycallback_f usr_callback){
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
  ret->context = jdata_subscribe_to_server( variable_name, jbroadcaster_msg_rcv_callback, NULL, NULL);

  // sprintf(buf, "jbroadcast_func_%s", variable_name);
  
  //IMPORTANT
  //REGISTERS the usercallback as a jasync callback to be called. 
  //This allows us to call the user defined callbacks for jbroadcaster
 // activity_regcallback(j_s->atable, buf, ASYNC, "v", ret->usr_callback);
  return ret;
}

void msg_rcv_usr_callback(void *ten, void *arg){
    printf("This was activated ... \n");
    command_t *cmd = (command_t *)arg;
    jbroadcaster *x = (jbroadcaster *)cmd->args[0].val.nval;
    printf("\n-------------------\nReceived: %s\n-------------------\n", (char *)x->data);
}

void jbroadcast_set_callback(jbroadcaster *jb, activitycallback_f usr_callback){
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
void *get_jbroadcaster_value(jbroadcaster *j){
  if(j->data == NULL)
  {
    printf("Null get attempt ...\n");
    return "00";
  }
  //assert(j->data != NULL);
  return j->data;
}

/*
 * Logs an jdata activity 
 * This is for some logging service that was supposed to be called whenever an activity gets called. 
 * 
 */
void jcmd_log_pending_activity(char *app_id, char *actid, int index){
    char key[256];
    char actid_expanded[128];
    sprintf(key, "%s%s%s", CMD_LOGGER, DELIM, app_id);
    sprintf(actid_expanded, "%s|%d", actid, index);
    redisAsyncCommand(jdata_async_context, jdata_default_msg_received, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                            local t = (redis.call('TIME'))[1]; \
                                                            redis.call('ZADD', KEYS[1], t, ARGV[1]); \
                                                            return {t}", key, actid);
}
/*
 * The log inserted can beg removed when the activity is acknowledged. 
 *
 */
void jcmd_remove_acknowledged_activity(char *app_id, char *actid, int index){
    char key[256];
    char actid_expanded[128];
    sprintf(actid_expanded, "%s|%d", actid, index);
    sprintf(key, "%s%s%s", CMD_LOGGER, DELIM, app_id);
    jdata_remove_element(key, actid, NULL);
}

/*
 * Removes completely the activity from redis include all logs of it. 
 */
void jcmd_delete_pending_activity_log(char *key, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;
  redisAsyncCommand(jdata_async_context, callback, NULL, "DEL %s", key);
}

/*
 * Returns a list of array of all logs for a particular key. 
 */
char **jcmd_get_pending_activity_log(char *key, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;
   redisReply * r = redisCommand(jdata_sync_context, "ZRANGE %s 0 -1", key);
   if (r->type == REDIS_REPLY_ARRAY) {
     char **ret = (char **)calloc(r->elements, sizeof(char *));
     for (int j = 0; j < r->elements; j++) {
       ret[j] = strdup(r->element[j]->str);
     }
     return ret;
   }
   return NULL;
}
