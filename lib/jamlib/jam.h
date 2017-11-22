/*

The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __JAMLIB_H__
#define __JAMLIB_H__

#include "core.h"
#include "simplequeue.h"
#include "semqueue.h"
#include "activity.h"
#include "timer.h"
#include "command.h"
#include <pthread.h>
#include "jcond.h"
#include "task.h"
#include "threadsem.h"
#include "comboptr.h"
#include "jamdata.h"

#include <event.h>
#include <hiredis/async.h>


#define STACKSIZE                   20000

// TODO: Max entries.. sufficient?
#define MAX_RUN_ENTRIES             16
#define MAX_FIELD_LEN               64

typedef struct _runtableentry_t
{
    char actid[MAX_FIELD_LEN];
    char actname[MAX_FIELD_LEN];
    int status;
    long long accesstime;
    enum activity_type_t type;

} runtableentry_t;


typedef struct _runtable_t
{
    void *jarg;

    runtableentry_t *entries;
    int rcount;
    pthread_mutex_t lock;

} runtable_t;



typedef struct _jamstate_t
{
    struct event_base *eloop;               // Loop used for logging

    struct event_base *bloop;               // Loop used by all broadcast callbacks

    // TODO: Each broadcast variable has its own callback.. too many??

    redisAsyncContext *redctx;

    timertype_t *maintimer;
    timertype_t *synctimer;

    corestate_t *cstate;
    activity_table_t *atable;
    runtable_t *rtable;

    // No need to use the pushqueue_t here.
    // We are watching the file descriptors of these queues
    //
    simplequeue_t *deviceinq;
    simplequeue_t *foginq;
    simplequeue_t *cloudinq;

    // We can still use the simplequeue_t
    // We wait on this queue.. and the wait would be blocking..
    // The pushqueue_t is used to wait without blocking the user-level threads...
    // With kernel-level threading that concern is not there.
    //
    semqueue_t *dataoutq;

    struct nn_pollfd *pollfds;
    int numpollfds;

    pthread_t bgthread;
    pthread_t jdthread;

    threadsem_t *bgsem;
    threadsem_t *jdsem;

} jamstate_t;


jamstate_t *jam_init(int port, int serialnum);

void jam_run_app(void *arg);
void jam_event_loop(void *js);
jactivity_t *jam_create_activity(jamstate_t *js);
int machine_height(jamstate_t *js);
int requested_level(int cvec);
int jamargs(int argc, char **argv, char *appid, char *tag, int *num);

/*
 * Functions defined in jamsync.c
 */

arg_t *jam_rexec_sync(jamstate_t *js, char *condstr, int condvec, char *aname, char *fmask, ...);
arg_t *jam_sync_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);
int get_sleep_time(jactivity_t *jact);
char *get_root_condition(jamstate_t *js);

/*
 * Functions defined in jamasync.c
 */
jactivity_t *jam_lexec_async(char *aname, ...);
jactivity_t *jam_rexec_async(jamstate_t *js, jactivity_t *jact, char *condstr, int condvec, char *aname, char *fmask, ...);
void jam_rexec_run_wrapper(void *arg);
jactivity_t *jam_async_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);
void set_jactivity_state(jactivity_t *jact, int nreplies);
void process_missing_replies(jactivity_t *jact, int nreplies, int ecount);


/*
 * Functions defined in jamworker.c
 */
void *jwork_bgthread(void *arg);
void jwork_set_subscriptions(jamstate_t *js);

void jwork_msg_delivered(void *ctx, MQTTAsync_deliveryComplete dt);
int jwork_msg_arrived(void *ctx, char *topicname, int topiclen, MQTTAsync_message *msg);
void jwork_connect_lost(void *context, char *cause);

void jwork_assemble_fds(jamstate_t *js);
int jwork_wait_fds(jamstate_t *js);
void jwork_processor(jamstate_t *js);
void jwork_process_globaloutq(jamstate_t *js);
void jwork_process_actoutq(jamstate_t *js, int indx);

void jwork_process_device(jamstate_t *js);
void jwork_process_fog(jamstate_t *js);
void jwork_process_cloud(jamstate_t *js);

void jwork_send_error(jamstate_t *js, command_t *cmd, char *estr);
void jwork_send_results(jamstate_t *js, char *opt, char *actname, char *actid, arg_t *args);
void jwork_send_nak(jamstate_t *js, command_t *cmd, char *estr);

command_t *jwork_runid_status(jamstate_t *js, char *runid);
command_t *jwork_device_status(jamstate_t *js);

command_t *jwork_runid_kill(jamstate_t *js, char *runid);

void jam_set_timer(jamstate_t *js, char *actarg, int tval);
void jam_clear_timer(jamstate_t *js, char *actid);

// Prototypes for functions in
// jamrunner.c
//

runtable_t *runtable_new(void *arg);
runtableentry_t *runtable_find(runtable_t *table, char *actid);
runtableentry_t *runtable_getfree(runtable_t *table);
bool runtable_insert(jamstate_t * js, char *actid, command_t *cmd);
bool runtable_del(runtable_t *tbl, char *actid);
bool runtable_store_results(runtable_t *tbl, char *actid, arg_t *results);
void runtable_insert_synctask(jamstate_t *js, command_t *rcmd, int quorum);
int runtable_synctask_count(runtable_t *rtbl);

command_t *get_actid_results(jamstate_t *js, char *actid);

bool jrun_check_signature(activity_callback_reg_t *creg, command_t *cmd);
void jrun_arun_callback(jactivity_t *jact, command_t *cmd, activity_callback_reg_t *creg);

bool jwork_evaluate_cond(char *cond);

#endif  /* __JAMLIB_H__ */

#ifdef __cplusplus
}
#endif
