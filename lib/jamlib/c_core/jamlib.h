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
#include "callback.h"
#include "event.h"
#include "timer.h"
#include "command.h"

#include <pthread.h>

#include "task.h"
#include "threadsem.h"

#define STACKSIZE                   50000

typedef struct _jamstate_t
{
    char *appname;
    corestate_t *cstate;
    pthread_t bgthread;
    callbacks_t *callbacks;
    activitytable_t *atable;

    struct nn_pollfd *pollfds;
    int numpollfds;
    
    timertype_t *maintimer;
    threadsem_t *bgsem;
    
    int maxleases;

} jamstate_t;

typedef struct _temprecord_t
{
    jamstate_t *jstate;
    jactivity_t *jact;
    command_t *cmd;

} temprecord_t;


jamstate_t *jam_init();

void jam_run_app(void *arg);
void jam_event_loop(void *js);

event_t *jam_get_event(jamstate_t *js);

void jam_reg_callback(jamstate_t *js, char *aname, eventtype_t etype,
                                                event_callback_f cb, void *data);


/*
 * Functions defined in jamsync.c
 */

arg_t *jam_rexec_sync(jamstate_t *js, char *aname, ...);
void jam_sync_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);

arg_t *jam_rexec_sync2(jamstate_t *js, char *aname, ...);
void jam_sync_runner2(jamstate_t *js, jactivity_t *jact, command_t *cmd);
/*
 * Functions defined in jamasync.c
 */

jactivity_t *jam_rexec_async(jamstate_t *js, char *aname, ...);
temprecord_t *jam_create_temprecord(jamstate_t *js, jactivity_t *jact, command_t *cmd);
void jam_rexec_run_wrapper(void *arg);

/*
 * Functions defined in jamworker.c
 */
void *jamworker_bgthread(void *arg);
void jamworker_assemble_fds(jamstate_t *js);
int jamworker_wait_fds(jamstate_t *js, int beattime);
void jamworker_processor(jamstate_t *js);
void jamworker_process_reqsock(jamstate_t *js);
void jamworker_process_subsock(jamstate_t *js);
void jamworker_process_respsock(jamstate_t *js);
void jamworker_process_globaloutq(jamstate_t *js);
void jamworker_process_actoutq(jamstate_t *js, int indx);
command_t *jamworker_runid_status(jamstate_t *js, char *runid);
command_t *jamworker_device_status(jamstate_t *js);

command_t *jamworker_runid_kill(jamstate_t *js, char *runid);
void jam_send_ping(jamstate_t *js);

void jam_set_timer(jamstate_t *js, char *actarg, int tval);
void jam_clear_timer(jamstate_t *js, char *actid);

bool jam_eval_condition(char *expr);

#endif  /* __JAMLIB_H__ */

#ifdef __cplusplus
}
#endif
