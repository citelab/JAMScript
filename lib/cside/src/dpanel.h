#ifndef __DPANEL_H__
#define __DPANEL_H__

#include <sys/queue.h>
#include <pthread.h>
#include <assert.h>
#include <string.h>
#include <uthash.h>

#include <event.h>
#include <hiredis/async.h>


#include <tinycbor/cbor.h>

#include "queue/queue.h"
#include "nvoid.h"
#include "auxpanel.h"

extern int derror;

enum dfstate   {NEW_STATE = 0,
                CLIENT_READY = 1};

typedef struct {
    char *key;
    char *fmt;
    uint64_t clock;
    char *value;
    int len;
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

typedef struct {
    char* label;
    char type;
    void* loc;
    UT_hash_handle hh;
} darg_entry_t;

enum dpstate_t {
    NEW = 0,
    STARTED = 1,
    STOPPED = 2,
    REGISTERED = 3,
};


#define  MAX_SERVER_LEN             64
#define  DP_MAX_ERROR_COUNT         5

typedef struct {

    enum dpstate_t state;
    int ecount;
    int logical_id;
    int logical_appid;
    char *uuid;
    char server[MAX_SERVER_LEN];
    int port;
    bool use_apanel;

    pthread_t ufprocessor;
    pthread_t dfprocessor;

    pthread_cond_t ufcond;
    pthread_cond_t dfcond;

    pthread_mutex_t mutex;

    pthread_mutex_t ufmutex;
    pthread_mutex_t dfmutex;

    struct queue ufqueue;
    dftable_entry_t *dftable;
    uftable_entry_t *uftable;

    struct event_base *uloop;
    struct event_base *dloop;

    redisAsyncContext *uctx;
    redisAsyncContext *dctx;
    redisAsyncContext *dctx2;

    arecord_t *apanels;

    void *cnode;
    void *tboard;

} dpanel_t;

dpanel_t *dpanel_create(char *server, int port, char *uuid);
void dpanel_setcnode(dpanel_t *dp, void *cn);
void dpanel_settboard(dpanel_t *dp, void *tb);
void dpanel_start(dpanel_t *dp);
void dpanel_shutdown(dpanel_t *dp);

void dpanel_add_apanel(dpanel_t *dp, char *nid, void *a);
void dpanel_del_apanel(dpanel_t *dp, char *nid);

uftable_entry_t *dp_create_uflow(dpanel_t *dp, char *key, char *fmt);
struct queue_entry *get_uflow_object(dpanel_t *dp, bool *last);
dftable_entry_t *dp_create_dflow(dpanel_t *dp, char *key, char *fmt);
void freeUObject(uflow_obj_t *uobj);

void dflow_callback(redisAsyncContext *c, void *r, void *privdata);
void dpanel_ucallback2(redisAsyncContext *c, void *r, void *privdata);
void dpanel_dcallback2(redisAsyncContext *c, void *r, void *privdata);

void ufwrite_int(uftable_entry_t* uf, int64_t x);
void ufwrite_uint(uftable_entry_t* uf, uint64_t x);
void ufwrite_double(uftable_entry_t* uf, double x);
void ufwrite_str(uftable_entry_t* uf, char* str);
void ufwrite_array(uftable_entry_t* uf, uint8_t* buf, size_t buflen, nvoid_t* str);
void ufwrite_struct(uftable_entry_t* uf, uint8_t* buf, size_t buflen, char* fmt, ...);

void dfread_basic_type(dftable_entry_t* df, char type, void* loc);
void dfread_struct(dftable_entry_t* df, darg_entry_t* darg_mem, char* fmt, ...);

void do_nvoid_encoding(CborEncoder* enc, nvoid_t* nv);
void do_struct_encoding(CborEncoder* enc, char* fmt, va_list args);

int __extract_cbor_type(CborValue* dec, void* loc, char type);
int __extract_basic_type(const uint8_t* buffer, size_t len, char type, void* loc);
int __extract_map(const uint8_t* buffer, size_t len, darg_entry_t* dargs);

#endif
