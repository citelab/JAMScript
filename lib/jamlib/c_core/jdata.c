/*
 * Author: Xiru Zhu
 * Date: July 4 2016
 */
#include "jdata.h"

char app_id[256];
char dev_id[256];
int jdata_seq_num = 0;

//redis server connection parameters
char *redis_serv_IP;
int redis_serv_port;

jamstate_t *j_s;

//redisAsyncContext *jdata_async_subscriber_context;//for asynchronous calls to logger
redisAsyncContext *jdata_async_non_sub_context;//for asynchronous calls to logger

redisContext *jdata_sync_context;

struct event_base *base;

jdata_list_node *jdata_list_head = NULL;
jdata_list_node *jdata_list_tail = NULL;

char *jdata_strip_reply(redisReply *r){
  if (r == NULL) return NULL;
  if (r->type == REDIS_REPLY_ARRAY) {

  }
  return NULL;
}

void jdata_get_server_ip(jamstate_t *js){
  arg_t *res = jam_rexec_sync(js, "jdata_registration", "ss", app_id, dev_id);
  if(res == NULL){
    printf("Error... Server Connection Issues... \n");
    exit(1);
  }
  redis_serv_IP = strdup(res->val.sval);
  command_arg_free(res);
}

void jdata_init(jamstate_t *js){
  sprintf(app_id, "%s", js->cstate->conf->app_name);
  sprintf(dev_id, "%s", js->cstate->conf->device_id);
  j_s = js;
  jdata_seq_num = 0;
  redis_serv_IP = NULL;
  //redis_serv_IP = strdup("127.0.0.1");
  redis_serv_port = 6379; //Default Port Number

  base = event_base_new();
  /*
  jdata_async_subscriber_context = redisAsyncConnect(redis_serv_IP, redis_serv_port);
  if (jdata_async_subscriber_context->err) {
      printf("Error: %s\n", jdata_async_subscriber_context->errstr);
      // handle error
  }*/
  jdata_async_non_sub_context = redisAsyncConnect(redis_serv_IP, redis_serv_port);
  if (jdata_async_non_sub_context->err) {
      printf("Error: %s\n", jdata_async_non_sub_context->errstr);
      // handle error
  }
  /*
  redisLibeventAttach(jdata_async_subscriber_context, base);
  redisAsyncSetConnectCallback(jdata_async_subscriber_context, jdata_default_connection);
  redisAsyncSetDisconnectCallback(jdata_async_subscriber_context, jdata_default_disconnection);
  */
  redisLibeventAttach(jdata_async_non_sub_context, base);
  redisAsyncSetConnectCallback(jdata_async_non_sub_context, jdata_default_connection);
  redisAsyncSetDisconnectCallback(jdata_async_non_sub_context, jdata_default_disconnection);

  struct timeval timeout = { 1, 500000 }; // 1.5 seconds
  jdata_sync_context = redisConnectWithTimeout(redis_serv_IP, redis_serv_port, timeout);
  if (jdata_sync_context == NULL || jdata_sync_context->err) {
      if (jdata_sync_context) {
          printf("Connection error: %s\n", jdata_sync_context->errstr);
          redisFree(jdata_sync_context);
      } else {
          printf("Connection error: can't allocate redis context\n");
      }
  }
}

void *jdata_event_loop(void *args){
  jamstate_t *js = (jamstate_t *)args;
  jdata_init(js);
  thread_signal(js->jdata_sem);
  #ifdef DEBUG_LVL1
    printf("JData initialized...\n");
  #endif
  event_base_dispatch(base);
  jdata_free();
  return NULL;
}

void jdata_default_connection(const redisAsyncContext *c, int status) {
  if (status != REDIS_OK) {
      printf("Connection Error: %s\n", c->errstr);
      return;
  }
  #ifdef DEBUG_LVL1
    printf("Connected...\n");
  #endif
}

void jdata_default_disconnection(const redisAsyncContext *c, int status) {
  if (status != REDIS_OK) {
      printf("Disconnection Error: %s\n", c->errstr);
      return;
  }
  #ifdef DEBUG_LVL1
    printf("Disconnected...\n");
  #endif
}

void jdata_default_msg_received(redisAsyncContext *c, void *reply, void *privdata) {
  redisReply *r = reply;
  if (reply == NULL) return;
  if (r->type == REDIS_REPLY_ARRAY) {
      for (int j = 0; j < r->elements; j++) {
          printf("%u) %s\n", j, r->element[j]->str);
      }
  }else if(r->type == REDIS_REPLY_ERROR){
    printf("%s\n", r->str);
  }
    #ifdef DEBUG_LVL1
    printf("Broadcast received...\n");
  #endif
}

void jdata_log_to_server(char *key, char *value, msg_rcv_callback callback){
  jdata_seq_num++;
  //the loggerResponse is the onMessage handler (when something is received from the redis server),
  //the third parameter is anything to pass to the handler. In this case i think we need to pass a
  //reference to the key being saved so that we can cache the data on the client and/or report to the client
  //if anything failed during saving. Another option would be to return the saved key from the redis server
  //after execution. The limitation to this is that the key would only be returned on successful execution
  if(callback == NULL)
    callback = jdata_default_msg_received;

  int length = strlen(value) + strlen(DELIM) + strlen(app_id) + strlen(DELIM) + strlen(dev_id) + strlen(DELIM) + 10;
  char newValue[length];
  sprintf(newValue , "%s%s%s%s%s", value, DELIM, app_id, DELIM, dev_id);
  redisAsyncCommand(jdata_async_non_sub_context, callback, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                          local t = (redis.call('TIME'))[1]; \
                                                          local insert_order =  redis.call('ZCARD', KEYS[1]) + 1; \
                                                          redis.call('ZADD', KEYS[1], t, ARGV[1] .. \"$$$\" .. insert_order .. \"$$$\" .. t); \
                                                          return {t}", key, newValue);
  #ifdef DEBUG_LVL1
    printf("Logging executed...\n");
  #endif
}

void jdata_remove_element(char *key, char *value, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;  
  redisAsyncCommand(jdata_async_non_sub_context, callback, NULL, "ZREM %s %s", key, value);
  #ifdef DEBUG_LVL1
    printf("Element Removed...\n");
  #endif
}

redisAsyncContext *jdata_subscribe_to_server(char *key, msg_rcv_callback on_msg, connection_callback connect, connection_callback disconnect){
  char cmd[512];
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

  redisLibeventAttach(c, base);

  if(on_msg == NULL)
    on_msg = jdata_default_msg_received;
  sprintf(cmd, "SUBSCRIBE %s", key);
  redisAsyncCommand(c, on_msg, NULL, cmd);
  #ifdef DEBUG_LVL1
    printf("Subscribe executed...\n");
  #endif
  return c;
}

void jdata_run_async_cmd(char *cmd, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;
  redisAsyncCommand(jdata_async_non_sub_context, callback, NULL, cmd);
  #ifdef DEBUG_LVL1
    printf("Async Command Run...\n");
  #endif
}

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

void jdata_free(){
  // To do
}

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
  ret->usr_callback = usr_callback;
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
  sprintf(buf, "jbroadcast_func_%s", variable_name);
  activity_regcallback(j_s->atable, buf, ASYNC, "v", usr_callback);
  return ret;
}

void jbroadcaster_msg_rcv_callback(redisAsyncContext *c, void *reply, void *privdata){
  redisReply *r = reply;
  char *result;
  char *var_name;
  char buf[256];
  if (reply == NULL) return;
  if (r->type == REDIS_REPLY_ARRAY) {
    var_name = r->element[1]->str;
    result = r->element[2]->str;

    if(result != NULL){
      for(jdata_list_node *i = jdata_list_head; i != NULL; i = i->next){
        if(strcmp(i->data.jbroadcaster_data->key, var_name) == 0){
          result = strdup(result);
          //At this point, we may need to add a lock to prevent race condition
          void *to_free = i->data.jbroadcaster_data->data;
          i->data.jbroadcaster_data->data = result;
          free(to_free);
          if(i->data.jbroadcaster_data->usr_callback != NULL){
            //So here instead of executing this function here, we need to insert this into the work queue
            sprintf(buf, "jbroadcast_func_%s", i->data.jbroadcaster_data->key);
            command_t *rcmd = command_new("REXEC-JDATA", "ASY", buf, "__", "0", "p", i->data.jbroadcaster_data);
            queue_enq(j_s->atable->globalinq, rcmd, sizeof(command_t));
            thread_signal(j_s->atable->globalsem);
            //i->data.jbroadcaster_data->usr_callback(NULL, i->data.jbroadcaster_data);
          }
          return;
        }
      }
      printf("Variable not found ... \n");
    }
  }
}

void *get_jbroadcaster_value(jbroadcaster *j){
  return j->data;
}

jshuffler *jshuffler_init(int type, char *var_name, activitycallback_f usr_callback){
  jshuffler *ret = calloc(1, sizeof(jshuffler));
  char buf[256];
  ret->key = strdup(var_name);
  sprintf(ret->rr_queue, "JSHUFFLER_rr_queue|%s", app_id);
  sprintf(ret->data_queue, "JSHUFFLER_data_queue|%s", app_id);
  sprintf(ret->subscribe_key, "JSHUFFLER|%s", app_id);
  ret->data = NULL;
  ret->usr_callback = usr_callback;
  sem_init(&ret->lock, 0, 0);
  redisAsyncContext *subscriber_context = redisAsyncConnect(redis_serv_IP, redis_serv_port);
  if (subscriber_context->err) {
      printf("error: %s\n", subscriber_context->errstr);
      return NULL;
  }
  if(jdata_list_head == NULL){
    jdata_list_head = (jdata_list_node *)calloc(1, sizeof(jdata_list_node));
    jdata_list_head->data.jshuffler_data = ret;
    jdata_list_tail = jdata_list_head;
    jdata_list_tail->next = NULL;
  }else{
    jdata_list_tail->next = (jdata_list_node *)calloc(1, sizeof(jdata_list_node));
    jdata_list_tail = jdata_list_tail->next;
    jdata_list_tail->data.jshuffler_data = ret;
    jdata_list_tail->next = NULL;
  }

  redisAsyncSetConnectCallback(subscriber_context, jdata_default_connection);
  redisAsyncSetConnectCallback(subscriber_context, jdata_default_disconnection);
  redisLibeventAttach(subscriber_context, base);
  redisAsyncCommand(subscriber_context, jshuffler_callback, NULL, "SUBSCRIBE %s", ret->subscribe_key);
  sprintf(buf, "jshuffler_func_%s", var_name);
  activity_regcallback(j_s->atable, var_name, ASYNC, "v", usr_callback);
  return ret;
}

void jshuffler_callback(redisAsyncContext *c, void *reply, void *privdata){
  redisReply *r = (redisReply *)reply;
  char var_name[256];
  char buf[256];
  char *result;
  char *result_ptr;
  if(r == NULL) return;
  if (r->type == REDIS_REPLY_ARRAY) {
    if(strcmp(r->element[0]->str, "message") == 0){
      result_ptr = strstr(r->element[2]->str, "$$$");
      memcpy(var_name, r->element[2]->str, result_ptr - r->element[2]->str);
      var_name[result_ptr - r->element[2]->str] = '\0';
      result = calloc(strlen(r->element[2]->str) - strlen(var_name), sizeof(char));
      sprintf(result, "%s", result_ptr + 3);

      for(jdata_list_node *i = jdata_list_head; i != NULL; i = i->next){
        if(strcmp(i->data.jshuffler_data->key, var_name) == 0){
          //At this point, we may need to add a lock to prevent race condition
          void *to_free = i->data.jshuffler_data->data;
          i->data.jshuffler_data->data = result;
          free(to_free);
          if(i->data.jshuffler_data->usr_callback != NULL){
            sprintf(buf, "jshuffler_func_%s", i->data.jbroadcaster_data->key);
            command_t *rcmd = command_new("REXEC-JDATA", "ASY", buf, "__", "0", "p", i->data.jshuffler_data);
            queue_enq(j_s->atable->globalinq, rcmd, sizeof(command_t));
            thread_signal(j_s->atable->globalsem);
          }
          #ifdef DEBUG_LVL1
            printf("Result Received:%s\n", result);
          #endif
          //sem_post(&i->data.jshuffler_data->lock);
          return;
        }
      }
      printf("Variable name not found ...\n");
    }
  }
}

void jshuffler_push(jshuffler *j, char *data){
  #ifdef DEBUG_LVL1
    printf("%s %s %s\n", j->subscribe_key, j->rr_queue,  j->data_queue);
  #endif
  redisAsyncCommand(jdata_async_non_sub_context, jdata_default_msg_received, NULL,
                    "EVAL %s 3 %s %s %s %s",
                    "redis.replicate_commands(); \
                    local send_to = redis.call('LLEN', KEYS[1]); \
                    if (send_to == 0) or (send_to == nil) then \
                      redis.call('RPUSH', KEYS[3], ARGV[1]); \
                      return {0}; \
                    else \
                      local var_name = redis.call('RPOP', KEYS[1]); \
                      redis.call('PUBLISH', KEYS[2] , var_name .. '$$$' .. ARGV[1]); \
                      return {send_to}; \
                    end", j->rr_queue, j->subscribe_key, j->data_queue, data);
}

void *jshuffler_poll(jshuffler *j){
  //#ifdef DEBUG_LVL1
    printf("%s %s %s\n", j->subscribe_key, j->rr_queue,  j->data_queue);
  //#endif
    redisReply *ret  = redisCommand(jdata_sync_context,
                      "EVAL %s 2 %s %s %s",
                      "redis.replicate_commands(); \
                      local rr_queue_size = redis.call('LLEN', KEYS[1]); \
                      local data_queue_size = redis.call('LLEN', KEYS[2]); \
                      if (rr_queue_size == 0 or rr_queue_size == nil) and (data_queue_size > 0) then \
                        local ret = redis.call('RPOP', KEYS[2]); \
                        return {ret}; \
                      else \
                        redis.call('RPUSH', KEYS[1], ARGV[1]); \
                        return {'JSHUFFLER_WAIT'}; \
                      end", j->rr_queue, j->data_queue, j->key);
  if (ret->type == REDIS_REPLY_ARRAY) {
  if(strcmp(ret->element[0]->str, "JSHUFFLER_WAIT") == 0){
    printf("Polling ... \n");
    sleep(1);
    return jshuffler_poll(j);
    //sem_wait(&j->lock);
  }
    j->data = ret;
  }
  return j->data;
}

void jcmd_log_pending_activity(char *app_id, char *actid){
    char key[256];
    sprintf(key, "%s%s%s", CMD_LOGGER, DELIM, app_id);
    redisAsyncCommand(jdata_async_non_sub_context, jdata_default_msg_received, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); \
                                                            local t = (redis.call('TIME'))[1]; \
                                                            redis.call('ZADD', KEYS[1], t, ARGV[1]); \
                                                            return {t}", key, actid);
}

void jcmd_remove_acknowledged_activity(char *app_id, char *actid){
    char key[256];
    sprintf(key, "%s%s%s", CMD_LOGGER, DELIM, app_id);
    jdata_remove_element(key, actid, NULL);
}

void jcmd_delete_pending_activity_log(char *key, msg_rcv_callback callback){
  if(callback == NULL)
    callback = jdata_default_msg_received;
  redisAsyncCommand(jdata_async_non_sub_context, callback, NULL, "DEL %s", key);
}

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