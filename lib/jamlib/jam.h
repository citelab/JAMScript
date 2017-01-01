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


#define STACKSIZE                   50000
#define MAX_RUN_ENTRIES             32


typedef struct _runtableentry_t
{
    char *runid;
    char *actname;
    char *actid;
    int status;
    int index;

    command_t *cmd;

    int num_replies;
    arg_t *result_list[MAX_SERVERS]; //The results
} runtableentry_t;


typedef struct _runtable_t
{
    int numruns;
    runtableentry_t *entries[MAX_RUN_ENTRIES];

} runtable_t;


typedef struct _jamstate_t
{
    corestate_t *cstate;
    activitytable_t *atable;
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

    timertype_t *maintimer;

} jamstate_t;


jamstate_t *jam_init(int port);

void jam_run_app(void *arg);
void jam_event_loop(void *js);


/*
 * Functions defined in jamsync.c
 */

arg_t *jam_rexec_sync(jamstate_t *js, char *aname, char *fmask, ...);
arg_t *jam_sync_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);
int get_sleep_time(jactivity_t *jact);

/*
 * Functions defined in jamasync.c
 */

jactivity_t *jam_rexec_async(jamstate_t *js, char *aname, char *fmask, ...);
void jam_rexec_run_wrapper(void *arg);
void jam_async_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);

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

void jwork_send_error(MQTTClient mcl, command_t *cmd, char *estr);
void jwork_send_nak(MQTTClient mcl, command_t *cmd, char *estr);
bool jwork_check_condition(jamstate_t *js, command_t *cmd);
bool jwork_check_args(jamstate_t *js, command_t *cmd);
bool jwork_synchronize(jamstate_t *js);

command_t *jwork_runid_status(jamstate_t *js, char *runid);
command_t *jwork_device_status(jamstate_t *js);

command_t *jwork_runid_kill(jamstate_t *js, char *runid);

void jam_set_timer(jamstate_t *js, char *actarg, int tval);
void jam_clear_timer(jamstate_t *js, char *actid);

bool jam_eval_condition(char *expr);
runtable_t *jwork_runtable_new();
void jwork_runid_complete(jamstate_t *js, runtable_t *rtab, char *runid, arg_t *arg);
bool jwork_runtable_check(runtable_t *rtable,  command_t *cmd);
bool insert_runtable_entry(jamstate_t *js, command_t *rcmd);
runtableentry_t *find_table_entry(runtable_t *rtable, command_t *cmd);
command_t *prepare_sync_return_result(runtableentry_t *r, command_t *cmd);
void free_rtable_entry(runtable_t *table, runtableentry_t *entry);
command_t *return_err_arg(command_t *rcmd, char *err_msg);
/*
 * Functions defined in jamrunner.c
 */

// TODO: Fix these tasks...

bool jrun_check_signature(activity_callback_reg_t *creg, command_t *cmd);
void jrun_arun_callback(activitytable_t *at, command_t *cmd, activity_callback_reg_t *creg);
void jrun_run_callback(jamstate_t *js, command_t *cmd, activity_callback_reg_t *arg);


#endif  /* __JAMLIB_H__ */

#ifdef __cplusplus
}
#endif
