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

enum dfstate   {NEW_STATE = 0,
                PRDY_RECEIVED = 1,
                CRDY_RECEIVED = 2,
                BOTH_RECEIVED = 3};

typedef struct {
    char *key;
    char *fmt;
    uint64_t clock;
    char *value;
} uflow_obj_t;

typedef struct {
    char *key;
    char *fmt;
    uint64_t lclock;
    void *dpanel;
    UT_hash_handle hh;
} uftable_entry_t;


typedef struct {
    char *key;
    char *fmt;
    enum dfstate state;
    uint64_t taskid;
    pthread_mutex_t mutex;
    void *dpanel;
    UT_hash_handle hh;
} dftable_entry_t;

enum dpstate_t {
    NEW = 0,
    STARTED = 1,
    STOPPED = 2,
    REGISTERED =3,
};

#define  MAX_SERVER_LEN             64
#define  DP_MAX_ERROR_COUNT         5

typedef struct {

    enum dpstate_t state;
    int ecount;
    int logical_id;
    char *uuid;
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

    void *cnode;
    void *tboard;

} dpanel_t;

dpanel_t *dpanel_create(char *server, int port, char *uuid);
void dpanel_start(dpanel_t *dp);
void dpanel_shutdown(dpanel_t *dp);

uftable_entry_t *dp_create_uflow(dpanel_t *dp, char *key, char *fmt);
dftable_entry_t *dp_create_dflow(dpanel_t *dp, char *key, char *fmt);

void ufwrite(uftable_entry_t *uf, int x);
void dfread(dftable_entry_t *df, void *val);

#endif