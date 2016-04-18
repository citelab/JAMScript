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

#include <pthread.h>

typedef struct _jamstate_t
{
    char *appname;
    corestate_t *cstate;
    pthread_t bgthread;
    callbacks_t *callbacks;
    activitytable_t *atable;

    struct nn_pollfd *pollfds;
    int numpollfds;

    int maxleases;

} jamstate_t;

typedef struct _temprecord_t
{
    jamstate_t *jstate;
    jactivity_t *jact;
    command_t *cmd;

} temprecord_t;


jamstate_t *jam_init();
bool jam_create_bgthread(jamstate_t *js);
bool jam_exit(jamstate_t *js);
void jam_event_loop(void *js);
bool jam_core_ready(jamstate_t *js);
int jam_execute_func(jamstate_t *js, const char *fname, const char *fmt, ...);
void jam_reg_callback(jamstate_t *js, char *aname, eventtype_t etype,
                                                event_callback_f cb, void *data);

temprecord_t *jam_create_temprecord(jamstate_t *js, jactivity_t *jact, command_t *cmd);
void jam_rexec_run_wrapper(void *arg);
void jam_rexec_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd);

event_t *get_event(jamstate_t *js);

/*
 * Functions defined in jamworker.c
 */
void *jamworker_bgthread(void *arg);
void jamworker_assemble_fds(jamstate_t *js);
int jamworker_wait_fds(jamstate_t *js);
void jamworker_processor(jamstate_t *js);
void jamworker_process_reqsock(jamstate_t *js);
void jamworker_process_subsock(jamstate_t *js);
void jamworker_process_respsock(jamstate_t *js);
void jamworker_process_globaloutq(jamstate_t *js);
void jamworker_process_actoutq(jamstate_t *js, int indx);
command_t *jamworker_activity_status(jamstate_t *js, char *indx);
command_t *jamworker_device_status(jamstate_t *js);

bool jam_ping_jcore(jamstate_t *js, int timeout);

void jam_set_timer(jamstate_t *js, char *actid, int timerval);
int jam_get_timer_from_reply(command_t *cmd);

#endif  /* __JAMLIB_H__ */

#ifdef __cplusplus
}
#endif
