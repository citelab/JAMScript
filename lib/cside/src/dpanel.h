#ifndef __DPANEL_H__
#define __DPANEL_H__

#include <sys/queue.h>
#include "queue/queue.h"
#include <pthread.h>
#include <assert.h>
#include <string.h>
#include <uthash.h>

#include <event.h>
#include <hiredis/async.h>
#include <hiredis/adapters/libevent.h>

typedef struct {
    char *key;
    char *fmt;
} uflow_entry_t;

typedef struct {
    char *key;
    char *fmt;
    struct queue dobjects;
    
} dflow_entry_t;

typedef struct {
    const char *key;
    dflow_entry_t *entry;
} dftable_entry_t;

typedef struct {
    const char *key;
    uflow_entry_t *entry;
} uftable_entry_t;


enum dpstate_t {
    NEW = 0,
    STARTED = 1,
    STOPPED = 2
};

#define  MAX_SERVER_LEN             64

typedef struct {

    enum dpstate_t state;
    char server[MAX_SERVER_LEN];
    int port;

    pthread_t ufprocessor;
    pthread_t dfprocessor;

    pthread_cond_t ufcond;
    pthread_cond_t dfcond;

    pthread_mutex_t ufmutex;
    pthread_mutex_t dfmutex;

    struct queue ufqueue;
    dftable_entry_t *dftable;
    uftable_entry_t *uftable;    

    struct event_base *uloop;
    struct event_base *dloop;

    redisAsyncContext *uctx;
    redisAsyncContext *dctx;

} dpanel_t;

dpanel_t *dpanel_create(char *server, int port);
void dpanel_start(dpanel_t *dp);
void dpanel_shutdown(dpanel_t *dp);

uflow_t *dp_create_uflow(dpanel_t *dp, char *key, char *fmt);
dflow_t *dp_create_dflow(dpanel_t *dp, char *key, char *fmt);

void ufwrite(uflow_t *uf, ...);
void dfread(dflow_t *df, void *val);

#endif