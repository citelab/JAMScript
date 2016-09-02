#ifndef __JDATA__
#define __JDATA__

#include <hiredis/hiredis.h>
#include <hiredis/async.h>
#include <hiredis/adapters/libevent.h>
#include "jam.h"
#include "activity.h"
#include <string.h>
#include <semaphore.h>
#include <unistd.h>

#define DELIM "$$$"
#define CMD_LOGGER "COMMAND_LOGGER"

typedef void (*connection_callback)(const redisAsyncContext *c, int status);
typedef void (*msg_rcv_callback)(redisAsyncContext *c, void *reply, void *privdata);

typedef struct jbroadcaster{
  char *key;
  void *data;
  activitycallback_f usr_callback;
  enum{
    JBROADCAST_INT,
    JBROADCAST_STRING,
    JBROADCAST_FLOAT
  }type;
  threadsem_t *write_sem;
  redisAsyncContext *context;
}jbroadcaster;

typedef struct jshuffler{
  char rr_queue[128];
  char data_queue[128];
  char subscribe_key[128];
  char *key;
  activitycallback_f usr_callback;
  void *data;
  sem_t lock;
}jshuffler;

typedef struct jdata_list_node{
  union{
    jbroadcaster *jbroadcaster_data;
    jshuffler *jshuffler_data;
  }data;
  struct jdata_list_node *next;
}jdata_list_node;

char *jdata_strip_reply(redisReply *r);
void jdata_get_server_ip(jamstate_t *js);
void jdata_init(jamstate_t *js);
void *jdata_event_loop(void *js);
void jdata_default_connection(const redisAsyncContext *c, int status);
void jdata_default_disconnection(const redisAsyncContext *c, int status);
void jdata_default_msg_received(redisAsyncContext *c, void *reply, void *privdata);
void jdata_log_to_server(char *key, char *value, msg_rcv_callback callback);
void jdata_remove_element(char *key, char *value, msg_rcv_callback callback);
redisAsyncContext *jdata_subscribe_to_server(char *key, msg_rcv_callback on_msg, connection_callback connect, connection_callback disconnect);
void jdata_run_async_cmd(char *cmd, msg_rcv_callback callback);
redisReply *jdata_run_sync_cmd(char *cmd);
void jdata_free();
jbroadcaster *jbroadcaster_init(int type, char *var_name, activitycallback_f usr_callback);
void *get_jbroadcaster_value(jbroadcaster *j);
void free_jbroadcaster_list();
void jbroadcaster_msg_rcv_callback(redisAsyncContext *c, void *reply, void *privdata);

void jshuffler_callback(redisAsyncContext *c, void *reply, void *privdata);
jshuffler *jshuffler_init(int type, char *var_name, activitycallback_f usr_callback);
void *jshuffler_poll(jshuffler *j);
void jshuffler_push(jshuffler *j, char *data);

void jcmd_log_pending_activity(char *app_id, char *actid, int index);
void jcmd_remove_acknowledged_activity(char *app_id, char *actid, int index);
void jcmd_delete_pending_activity_log(char *key, msg_rcv_callback callback);
char **jcmd_get_pending_activity_log(char *key, msg_rcv_callback callback);



#endif
