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

#include <stdlib.h>
#include <stdio.h>
#include <assert.h>
#include <string.h>
#ifdef __APPLE__
#include <mach/mach.h>
#include <mach/mach_time.h>
#endif

#include "activity.h"
#include "nvoid.h"
#ifdef linux
#include <time.h>
#endif

#include <task.h>

char *activity_gettime()
{
    char buf[64];
    #ifdef __APPLE__
        sprintf(buf, "%llu", mach_absolute_time());
        return strdup(buf);
    #endif

    #ifdef linux
        struct timespec tp;
        clock_gettime(CLOCK_MONOTONIC, &tp);
        sprintf(buf, "%li", tp.tv_nsec);
        return strdup(buf);
    #endif
    return 0;
}


activitytable_t *activity_table_new()
{
    int i;

    activitytable_t *atbl = (activitytable_t *)calloc(1, sizeof(activitytable_t));
    assert(atbl != NULL);

    atbl->numactivities = 0;
    atbl->numcbackregs = 0;

    for (i = 0; i < MAX_CALLBACKS; i++)
        atbl->callbackregs[i] = NULL;

    for (i = 0; i < MAX_ACTIVITIES; i++)
        atbl->activities[i] = activity_init();

    // globalinq is used by the main thread for input purposes
    // globaloutq is used by the main thread for output purposes
    atbl->globalinq = pqueue_new(true);
    atbl->globaloutq = queue_new(true);

    return atbl;
}

void activity_table_print(activitytable_t *at)
{
    int i;

    printf("\n");
    printf("Activity callback regs.: [%d] \n", at->numcbackregs);
    printf("Activity instances: [%d]\n", at->numactivities);
    printf("Registrations::\n");

    for (i = 0; i < at->numcbackregs; i++)
        activity_callbackreg_print(at->callbackregs[i]);

    printf("Activity instances::\n");
    for (i = 0; i < MAX_ACTIVITIES; i++)
        activity_print(at->activities[i]);

    printf("\n");
}

void activity_callbackreg_print(activity_callback_reg_t *areg)
{
    printf("\n");
    printf("Activity reg. name: %s\n", areg->name);
    printf("Activity reg. mask: %s\n", areg->signature);
    printf("Activity reg. type: %d\n", areg->type);
    printf("\n");
}

void activity_print(jactivity_t *ja)
{
    if (ja->state == EMPTY)
        return;

    printf("\n");
    printf("Activity ID: %s\n", ja->actid);
    printf("Activity arg: %s\n", ja->actarg);
    printf("Activity state: %d\n", ja->state);
    printf("Activity name: %s\n", ja->name);

    printf("\n");
}

bool activity_regcallback(activitytable_t *at, char *name, int type, char *sig, activitycallback_f cback)
{
    int i;

    // if a registration already exists, return false
    for (i = 0; i < at->numcbackregs; i++)
        if (strcmp(at->callbackregs[i]->name, name) == 0)
            return false;

    // otherwise, make a new activity registration.
    activity_callback_reg_t *creg = (activity_callback_reg_t *)calloc(1, sizeof(activity_callback_reg_t));
    strcpy(creg->name, name);
    strcpy(creg->signature, sig);
    creg->type = type;
    creg->cback = cback;

    at->callbackregs[at->numcbackregs++] = creg;

    #ifdef DEBUG_LVL1
        printf("Activity make success: %s.. made\n", name);
    #endif

    return true;
}


// TODO: What is the use of opt??
//
activity_callback_reg_t *activity_findcallback(activitytable_t *at, char *name, char *opt)
{
    int i;

    for (i = 0; i < at->numcbackregs; i++)
        if (strcmp(at->callbackregs[i]->name, name) == 0)
            return at->callbackregs[i];

    return NULL;
}

// Only the memory is initialized..
jactivity_t *activity_init()
{
    jactivity_t *jact = (jactivity_t *)calloc(1, sizeof(jactivity_t));

    // Setup the dummy activity
    jact->state = EMPTY;
    jact->name[0] = 0;
    jact->actid = NULL;
    jact->actarg = strdup("__");

    jact->taskid = 0;

    // Setup the I/O queues
    jact->inq = pqueue_new(true);
    jact->outq = queue_new(true);

    // initialize the reply placeholders
    for (int i = 0; i < MAX_REPLIES; i++)
        jact->replies[i] = NULL;

    // return the pointer
    return jact;
}


jactivity_t *activity_new(activitytable_t *at, char *name)
{
    jactivity_t *jact = NULL;
    // Cannot create another activity..
    if (at->numactivities >= MAX_ACTIVITIES)
        return NULL;

    // Find an empty activity entry. 
    for (int i = 0; i < MAX_ACTIVITIES; i++)
        if (at->activities[i]->state == EMPTY)
        {
            jact = at->activities[i];
            break;
        }

    if (jact != NULL) 
    {
        // Setup the new activity
        jact->state = NEW;
        strcpy(jact->name, name);
        jact->actid = activity_gettime();
        jact->actarg = strdup("__");

        // Save the task ID.. this is specific to libtask..
        jact->taskid = taskid();

        // Set the replies' pointer to NULL for good measure
        for (int i = 0; i < MAX_REPLIES; i++)
            jact->replies[i] = NULL;
    }

    // return the pointer
    return jact;
}


jactivity_t *activity_getbyid(activitytable_t *at, char *actid)
{
    int i;

    for (i = 0; i < MAX_ACTIVITIES; i++)
    {
        if ((at->activities[i]->state != EMPTY) &&
            (strcmp(at->activities[i]->actid, actid) == 0))
            return at->activities[i];
    }
    return NULL;
}


// returns -1 if the activity with given actid is not there
int activity_id2indx(activitytable_t *at, char *actid)
{
    int i;

    for (i = 0; i < MAX_ACTIVITIES; i++)
    {
        if ((at->activities[i]->state != EMPTY) &&
            (strcmp(at->activities[i]->actid, actid) == 0))
            return i;
    }
    return -1;
} 


jactivity_t *activity_getmyactivity(activitytable_t *at)
{
    int i;
    int tid = taskid();

    for (i = 0; i < MAX_ACTIVITIES; i++)
    {
        if ((at->activities[i]->state != EMPTY) &&
            (at->activities[i]->taskid == tid))
            return at->activities[i];
    }
    return NULL;
}


void activity_del(activitytable_t *at, jactivity_t *jact)
{
    int i;
    printf("Deleting activity ... %s\n", jact->actid);
    int j = activity_id2indx(at, jact->actid);

    // If the activity is pointing to one not in the table 
    // don't do anything. Something is Wrong!
    if (j < 0)
        return;

    jact->state = EMPTY;
    // Free memory that is not reuseable
    free(jact->actid);
    free(jact->actarg);

    for (i = 0; i < MAX_REPLIES; i++)
        if (jact->replies[i] != NULL)
            command_free(jact->replies[i]);

    // Set to save value
    jact->taskid = 0;
    jact->name[0] = 0;  

    at->numactivities--;
}


void activity_start(jactivity_t *jact)
{
    jact->state = STARTED;
}

void activity_timeout(jactivity_t *jact)
{
    jact->state = TIMEDOUT;
}


void activity_complete(activitytable_t *at, char *fmt, ...)
{
    va_list args;

    // Find the activity
    jactivity_t *jact = activity_getmyactivity(at);
    command_t *scmd;

    if (strlen(fmt) == 0)
        scmd = command_new("COMPL-ACT", "LOCAL", jact->name, jact->actid, jact->actarg, "");
    else
    {
        va_start(args, fmt);
        switch(*fmt)
        {
            case 'n':
                printf("Format for byte array... \n");
                scmd = command_new("COMPL-ACT", "LOCAL", jact->name, jact->actid, jact->actarg, "b", va_arg(args, nvoid_t*));
                break;

            case 's':
                printf("Format for string..... \n");

                scmd = command_new("COMPL-ACT", "LOCAL", jact->name, jact->actid, jact->actarg, "s", va_arg(args, char *));
                break;

            case 'i':
                printf("Format for integer..... \n");

                scmd = command_new("COMPL-ACT", "LOCAL", jact->name, jact->actid, jact->actarg, "i", va_arg(args, int));
                break;
            case 'd':
            case 'f':
                printf("Format for real..... \n");

                scmd = command_new("COMPL-ACT", "LOCAL", jact->name, jact->actid, jact->actarg, "d", va_arg(args, double));
        }
        va_end(args);
    }

    queue_enq(at->globaloutq, scmd, sizeof(command_t));
    // TODO: do we have to use another semaphore?
    // TODO: check??

    // Now.. delete the activity.
    //activity_del(at, jact);
}
