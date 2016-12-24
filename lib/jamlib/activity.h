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

#ifndef __ACTIVITY_H__
#define __ACTIVITY_H__

#include "nvoid.h"
#include "task.h"
#include "command.h"
#include "simplequeue.h"
#include "pushqueue.h"

#include <stdbool.h>
#include <stdint.h>

#define MAX_NAME_LEN            64
#define MAX_ACTIVITIES          16
#define MAX_CALLBACKS           32
#define MAX_REPLIES             5

typedef void (*activitycallback_f)(void *ten, void *arg);


enum activity_state_t
{
    EMPTY,
    COMPLETED,
    NEW,
    STARTED,
    NEGATIVE_COND,    
    PARAMETER_ERROR,
    TIMEDOUT,
    PARTIAL,
    FATAL_ERROR,
    ABORTED    
};


enum activity_type_t
{
    SYNC,
    ASYNC
};


typedef struct _jactivity_t
{
    char name[MAX_NAME_LEN];

    enum activity_state_t state;
    enum activity_type_t type;

    int taskid;
    char *actid;
    char *actarg;

    pushqueue_t *inq;
    simplequeue_t *outq;

    // Store all the replies we get... 
    // TODO: Wasting memory.. but we know what happened at different levels    
    command_t *replies[MAX_REPLIES];

} jactivity_t;


typedef struct _activity_callback_reg_t
{
    char name[MAX_NAME_LEN];
    char signature[MAX_NAME_LEN];
    activitycallback_f cback;

    enum activity_type_t type;

} activity_callback_reg_t;


typedef struct _activitytable_t
{
    int numactivities;
    int numcbackregs;
    // Callbacks are NOT pre-initialized..
    activity_callback_reg_t *callbackregs[MAX_CALLBACKS];
    // Activities are pre-initialized: they can be empty.. but the placeholdler is not released
    jactivity_t *activities[MAX_ACTIVITIES];

    simplequeue_t *globaloutq;
    pushqueue_t *globalinq;

} activitytable_t;


//
// Function prototypes..
//

char *activity_gettime();
activitytable_t *activity_table_new();
void activity_table_print(activitytable_t *at);
void activity_callbackreg_print(activity_callback_reg_t *areg);
void activity_print(jactivity_t *ja);

bool activity_regcallback(activitytable_t *at, char *name, int type, char *sig, activitycallback_f cback);
activity_callback_reg_t *activity_findcallback(activitytable_t *at, char *name, char *opt);

jactivity_t *activity_init();
jactivity_t *activity_new(activitytable_t *at, char *name);

jactivity_t *activity_getbyid(activitytable_t *at, char *actid);
int activity_id2indx(activitytable_t *at, char *actid);
jactivity_t *activity_getmyactivity(activitytable_t *at);
void activity_del(activitytable_t *at, jactivity_t *jact);

void activity_start(jactivity_t *act);
void activity_timeout(jactivity_t *act);

void activity_complete(activitytable_t *at, char *fmt, ...);

#endif
