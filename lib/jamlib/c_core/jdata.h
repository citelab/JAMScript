#ifndef __JDATA__
#define __JDATA__

#include <hiredis/hiredis.h>
#include <hiredis/async.h>
#include <hiredis/adapters/libevent.h>
#include "jam.h"
#include <string.h>

#define DELIM "$$$"
typedef void (*connection_callback)(const redisAsyncContext *c, int status);
typedef void (*msg_rcv_callback)(redisAsyncContext *c, void *reply, void *privdata);

void jdata_get_server_ip(jamstate_t * js);

void jdata_init(jamstate_t * js);

void *jdata_event_loop(void *js);

void jdata_default_connection(const redisAsyncContext *c, int status);

void jdata_default_disconnection(const redisAsyncContext *c, int status);

void jdata_default_msg_received(redisAsyncContext *c, void *reply, void *privdata);

void jdata_log_to_server(char *key, char *value, msg_rcv_callback callback);

redisAsyncContext *jdata_subscribe_to_server(char *key, msg_rcv_callback on_msg, connection_callback connect, connection_callback disconnect);

void jdata_run_async_cmd(char *cmd, msg_rcv_callback callback);

redisReply *jdata_run_sync_cmd(char *cmd);

void jdata_free();

#endif
