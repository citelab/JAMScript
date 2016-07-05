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

redisAsyncContext *jdata_async_context;//for asynchronous calls to logger
redisContext *jdata_sync_context;

struct event_base *base;

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
  jdata_seq_num = 0;
  redis_serv_IP = NULL;
  //redis_serv_IP = strdup("127.0.0.1");
  redis_serv_port = 6379;

  base = event_base_new();
  jdata_async_context = redisAsyncConnect(redis_serv_IP, redis_serv_port);
  if (jdata_async_context->err) {
      printf("Error: %s\n", jdata_async_context->errstr);
      // handle error
  }
  redisLibeventAttach(jdata_async_context, base);
  redisAsyncSetConnectCallback(jdata_async_context, jdata_default_connection);
  redisAsyncSetDisconnectCallback(jdata_async_context, jdata_default_disconnection);

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
  sprintf(newValue , "%s%s%s%s%s%s%d", value, delimiter, appID, delimiter, deviceID, delimiter, jdata_seq_num);

  redisAsyncCommand(jdata_async_context, callback, NULL, "EVAL %s 1 %s %s", "redis.replicate_commands(); local t = (redis.call('TIME'))[1]; redis.call('ZADD', KEYS[1], t, ARGV[1]); return {t}", key, newValue);
  #ifdef DEBUG_LVL1
    printf("Logging executed...\n");
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
  redisAsyncCommand(jdata_async_context, callback, NULL, cmd);
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
