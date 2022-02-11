#ifndef __JAMDATA_H__
#define __JAMDATA_H__

#include <stdlib.h>
#include <hiredis/hiredis.h>
#include <hiredis/async.h>

#include <hiredis/adapters/libevent.h>

#include <semaphore.h>
#include <cbor.h>
#include <time.h>

#include "jam.h"
#include "activity.h"
#include <string.h>
#include <unistd.h>

#include <stdarg.h>
#include <stdio.h>
#include <stdint.h>
#include <stddef.h>

#include "simplelist.h"
#include "pushqueue.h"

#include "cborutils.h"

#define DEFAULT_APP_NAME "APP"
#define DEFAULT_SERV_IP "127.0.0.1"
#define DEFAULT_SERV_PORT 6379


#define BCAST_RETURNS_NEXT          1
#define BCAST_RETURNS_LAST          2

typedef void (*connection_callback_f)(const redisAsyncContext *c, int status);
typedef void (*msg_rcv_callback_f)(redisAsyncContext *c, void *reply, void *privdata);

typedef struct _jambroadcaster_t
{
    int mode;
    char *key;

    pushqueue_t *dataq;

    list_elem_t *data;
#ifdef linux
    sem_t lock;
#elif __APPLE__
    sem_t *lock;
#endif
#ifdef linux
    sem_t icount;
#elif __APPLE__
    sem_t *icount;
#endif

    threadsem_t *readysem;

    pthread_t thread;
    redisAsyncContext *redctx;

} jambroadcaster_t;


void jamdata_def_connect(const redisAsyncContext *c, int status);
void jamdata_def_disconnect(const redisAsyncContext *c, int status);
void *jamdata_init(void *jsp);
char *jamdata_makekey(char *ns, char *lname);
void __jamdata_logto_server(redisAsyncContext *c, char *key, char *val, size_t size, unsigned long long time_stamp, msg_rcv_callback_f callback);
void jamdata_logger_cb(redisAsyncContext *c, void *reply, void *privdata);
comboptr_t *jamdata_encode(char *redis_key, unsigned long long timestamp, char *fmt, unsigned char *buffer, size_t buffer_len, va_list argptr);
void* jamdata_decode(char *fmt, char *data, int num, void *buffer, ...);
void jamdata_log_to_server(char *ns, char *lname, char *fmt, ...);
void jamdata_log_to_server_int(char *ns, char *lname, int value);
void jamdata_log_to_server_float(char *ns, char *lname, float value);
void jamdata_log_to_server_string(char *ns, char *lname, char *value);
comboptr_t *jamdata_simple_encode(char *redis_key, unsigned long long timestamp, unsigned char *buffer, size_t buffer_len, cbor_item_t *value);
unsigned long long ms_time();


jambroadcaster_t *jambroadcaster_init(int mode, char *ns, char *varname);
jambroadcaster_t *create_jambroadcaster(int mode, char *ns, char *varname);
char *get_bcast_value(jambroadcaster_t *bcast);
char *get_bcast_next_value(jambroadcaster_t *bcast);
char *get_bcast_last_value(jambroadcaster_t *bcast);
int get_bcast_int(char *msg);
float get_bcast_float(char *msg);
char *get_bcast_char(char *msg);
int get_bcast_count(jambroadcaster_t *bcast);
void *jambcast_runner(void *arg);
void jambcast_recv_callback(redisAsyncContext *c, void *r, void *privdata);


#endif
