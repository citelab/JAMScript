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
#include "activity.h"
#include "timer.h"
#include "command.h"
#include <pthread.h>
#include "jcondition.h"
#include "task.h"
#include "threadsem.h"


#define STACKSIZE                   20000

// TODO: Max entries.. sufficient?
#define MAX_RUN_ENTRIES             4


typedef struct _runtableentry_t
{
    char *actid;
    char *actname;
    int status;
    long long accesstime;
    enum activity_type_t type;

    int rcd_replies;
    // results hold remote results in the case of C->J or
    // local results in the case of J->C sync calls - only [0] used
    arg_t *results[MAX_SERVERS]; //The results
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
    timertype_t *maintimer;
    timertype_t *synctimer;

    corestate_t *cstate;
    activity_table_t *atable;
    runtable_t *rtable;

    // No need to use the pushqueue_t here.
    // We are watching the file descriptors of these queues
    simplequeue_t *deviceinq;
    simplequeue_t *foginq;
    simplequeue_t *cloudinq;

    struct nn_pollfd *pollfds;
    int numpollfds;

    pthread_t bgthread;
    pthread_t jdata_event_thread;

    threadsem_t *bgsem;
    threadsem_t *jdata_sem;

    int maxleases;

} jamstate_t;


typedef struct _callcontext_t
{
    simplequeue_t *queue;
    jamstate_t *context;
    int indx;

} callcontext_t;


jamstate_t *jam_init(int port);

void jam_run_app(void *arg);
void jam_event_loop(void *js);
jactivity_t *jam_create_activity(jamstate_t *js);
bool have_fog_or_cloud(jamstate_t *js);
int cloud_tree_height(jamstate_t *js);

/*
 * Functions defined in jamsync.c
 */

arg_t *jam_rexec_sync(jamstate_t *js, char *condstr, int condvec, char *aname, char *fmask, ...);
arg_t *jam_sync_runner(jamstate_t *js, jactivity_t *jact, int nodes, command_t *cmd);
int get_sleep_time(jactivity_t *jact);
char *get_root_condition(jamstate_t *js);

/*
 * Functions defined in jamasync.c
 */

jactivity_t *jam_rexec_async(jamstate_t *js, jactivity_t *jact, char *condstr, int condvec, char *aname, char *fmask, ...);
void jam_rexec_run_wrapper(void *arg);
void jam_async_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);
void set_jactivity_state(jactivity_t *jact, int nreplies);
void process_missing_replies(jactivity_t *jact, int nreplies, int ecount);


/*
 * Functions defined in jamworker.c
 */
void *jwork_bgthread(void *arg);
void jwork_set_subscriptions(jamstate_t *js);

void jwork_set_callbacks(jamstate_t *js);
void jwork_msg_delivered(void *ctx, MQTTClient_deliveryToken dt);
int jwork_msg_arrived(void *ctx, char *topicname, int topiclen, MQTTClient_message *msg);
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
void jwork_send_results(jamstate_t *js, char *actname, char *actid, arg_t *args);
void jwork_send_nak(jamstate_t *js, command_t *cmd, char *estr);
bool jwork_check_condition(jamstate_t *js, command_t *cmd);
bool jwork_check_args(jamstate_t *js, command_t *cmd);
int jwork_getquorum(jamstate_t *js, command_t *cmd);

command_t *jwork_runid_status(jamstate_t *js, char *runid);
command_t *jwork_device_status(jamstate_t *js);

command_t *jwork_runid_kill(jamstate_t *js, char *runid);

void jam_set_timer(jamstate_t *js, char *actarg, int tval);
void jam_clear_timer(jamstate_t *js, char *actid);


bool jcond_synchronized(command_t *cmd);



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

// jcond.h

bool jcond_evaluate_cond(jamstate_t *js, command_t *cmd);
bool jcond_synchronized(command_t *cmd);
int jcond_getquorum(command_t *cmd);

char *get_device_id(char *filepath);

#endif  /* __JAMLIB_H__ */

#ifdef __cplusplus
}
#endif
