#ifndef __AUX_PANEL_H__
#define __AUX_PANEL_H__

#include <sys/queue.h>
#include "queue/queue.h"
#include <pthread.h>
#include <assert.h>
#include <string.h>
#include <uthash.h>

#include <event.h>
#include <hiredis/async.h>
#include <hiredis/adapters/libevent.h>

#define MAX_NAME_LEN                64

typedef struct {
    char key[MAX_NAME_LEN];
    void *apanel;
    UT_hash_handle hh;
} arecord_t;


#define  MAX_SERVER_LEN             64
#define  DP_MAX_ERROR_COUNT         5

enum apstate_t {
    A_NEW = 0,
    A_STARTED = 1,
    A_STOPPED = 2,
    A_REGISTERED =3,
};

typedef struct {

    enum apstate_t state;
    void *dpanel;
    char server[MAX_SERVER_LEN];
    int port;
    int ecount;
    int logical_id;

    pthread_t a_ufprocessor;
    pthread_t a_dfprocessor;

    pthread_cond_t a_ufcond;
    pthread_cond_t a_dfcond;

    pthread_mutex_t a_ufmutex;
    pthread_mutex_t a_dfmutex;

    struct queue a_ufqueue;

    struct event_base *a_uloop;
    struct event_base *a_dloop;

    redisAsyncContext *a_uctx;
    redisAsyncContext *a_dctx;

} auxpanel_t;

auxpanel_t *apanel_create(void *dp, char *server, int port);
void apanel_free(auxpanel_t *ap);
void apanel_start(auxpanel_t *ap);
void apanel_shutdown(auxpanel_t *ap);
void apanel_send_to_fogs(arecord_t *ar, void *u);

void apanel_dcallback(redisAsyncContext *c, void *r, void *privdata);

#endif