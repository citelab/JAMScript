#ifndef __DPANEL_H__
#define __DPANEL_H__

#include <sys/queue.h>
#include <pthread.h>
#include <assert.h>
#include <string.h>
#include <uthash.h>

#include <event.h>
#include <hiredis/async.h>
#include <hiredis/adapters/libevent.h>

#include <tinycbor/cbor.h>

#include "queue/queue.h"
#include "nvoid.h"

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

typedef enum {
    U_NULL_TYPE,
    U_STRING_TYPE,
    U_INT_TYPE,
    U_LONG_TYPE,
    U_DOUBLE_TYPE,
    U_NVOID_TYPE,
    U_VOID_TYPE
} uargtype_t;

typedef struct {
    char *label;
    uargtype_t type;
    union _uargvalue_t
    {
        int ival;
        long int lval;
        char *sval;
        double dval;
        nvoid_t *nval;
        void *vval;
    } val;
} uarg_t;

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

void ufwrite_int(uftable_entry_t *uf, int x);
void ufwrite_double(uftable_entry_t *uf, double x);
void ufwrite_str(uftable_entry_t *uf, char *str);
void ufwrite_struct(uftable_entry_t *uf, char *fmt, ...);

void dfread(dftable_entry_t *df, void *val);

int estimate_cbor_buffer_len(uarg_t *u, int len);
void do_cbor_encoding(CborEncoder *enc, uarg_t *u, int len);
void free_buffer(uarg_t *u, int len);


#endif