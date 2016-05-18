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


char *activity_gettime()
{
    char buf[64];
    #ifdef __APPLE__
    sprintf(buf, "%llu", mach_absolute_time());
    return strdup(buf);
    #endif

    // TODO: Implement the timer capture for linux.
    return 0;
}


activitytable_t *activity_table_new()
{
    activitytable_t *atbl = (activitytable_t *)calloc(1, sizeof(activitytable_t));
    assert(atbl != NULL);

    atbl->numactivities = 0;
    atbl->numcbackregs = 0;

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
    for (i = 0; i < at->numactivities; i++)
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
    printf("\n");
    printf("Activity ID: %s\n", ja->actid);
    printf("Activity arg: %s\n", ja->actarg);
    printf("Activity state: %d\n", ja->state);
    printf("Activity name: %s\n", ja->name);
    if (ja->code != NULL)
        command_arg_print(ja->code);
    else
        printf("Activity code: NULL\n");
        
    if (ja->inq != NULL)
        queue_print(ja->inq);
    if (ja->outq != NULL)
        queue_print(ja->outq);    
        
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


activity_callback_reg_t *activity_findcallback(activitytable_t *at, char *name)
{
    int i;
    
    for (i = 0; i < at->numcbackregs; i++)
        if (strcmp(at->callbackregs[i]->name, name) == 0)
            return at->callbackregs[i];
    
    return NULL;
}


jactivity_t *activity_new(activitytable_t *at, char *name)
{
    jactivity_t *jact;

    jact = (jactivity_t *)calloc(1, sizeof(jactivity_t));
    at->activities[at->numactivities++] = jact;

    // Setup the new activity
    jact->state = NEW;
    strcpy(jact->name, name);
    jact->code = NULL;
    jact->sem = threadsem_new();
    jact->actid = activity_gettime();
    jact->actarg = strdup("__");

    // Setup the I/O queues
    jact->inq = queue_new(true);
    jact->outq = queue_new(true);

    printf("Creating the message... \n");
    // Send a message to the background so it starts watching for messages
    command_t *cmd = command_new("ASMBL-FDS", "LOCAL", name, jact->actid, jact->actarg, "s", "__");

    printf("Sending it.. \n");
    
    queue_enq(at->globaloutq, cmd, sizeof(command_t));
      
    #ifdef DEBUG_LVL1
        printf("Created the activity: %s\n", jact->name);
    #endif

    // return the pointer
    return jact;
}


jactivity_t *activity_getbyid(activitytable_t *at, char *actid)
{
    int i;

    for (i = 0; i < at->numactivities; i++)
    {
        if (strcmp(at->activities[i]->actid, actid) == 0)
            return at->activities[i];
    }
    return NULL;
}

void activity_del(activitytable_t *at, jactivity_t *jact)
{
    int i;
    
    // remove individual elements of the activity
    threadsem_free(jact->sem);
    free(jact->actid);
    free(jact->actarg);
    command_arg_free(jact->code);

    // delete the queues..
    queue_delete(jact->inq);
    queue_delete(jact->outq);

    int j = activity_getactindx(at, jact);
    
    for (i = j; i < at->numactivities; i++)
    {
        if (i < (at->numactivities - 1)) 
            at->activities[i] = at->activities[i+1];
    }
    
    at->numactivities--;

    // Send a message to the background so it starts watching for messages
    command_t *cmd = command_new("ASMBL-FDS", "LOCAL", jact->name, jact->actid, jact->actarg, "s", "temp");
 //   queue_enq(at->globaloutq, cmd, sizeof(command_t));
    
    free(jact);
}


int activity_getactindx(activitytable_t *at, jactivity_t *jact)
{
    int i;
    
    for (i = 0; i < at->numactivities; i++)
        if (at->activities[i] == jact)
            return i;
    return -1;
}


void activity_start(jactivity_t *jact)
{
    jact->state = RUNNING;
}

void activity_timeout(jactivity_t *jact)
{
    jact->state = EXEC_TIMEDOUT;
}
