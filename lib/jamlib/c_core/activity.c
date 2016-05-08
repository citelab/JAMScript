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
    atbl->numactivityregs = 0;

    return atbl;
}


void activity_table_print(activitytable_t *at)
{
    int i;

    printf("\n");
    printf("Activity registrations: [%d] \n", at->numactivityregs);
    printf("Activity instances: [%d]\n", at->numactivities);
    printf("Registrations::\n");
    
    for (i = 0; i < at->numactivityregs; i++)
        activity_reg_print(at->registrations[i]);

    printf("Activity instances::\n");
    for (i = 0; i < at->numactivities; i++)
        activity_print(at->activities[i]);

    printf("\n");
}

void activity_reg_print(activity_registry_t *areg)
{
    printf("\n");
    printf("Activity reg. name: %s\n", areg->name);
    printf("Activity reg. mask: %s\n", areg->mask);
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
        command_print_arg(ja->code);
    else
        printf("Activity code: NULL\n");
        
    if (ja->inq != NULL)
        queue_print(ja->inq);
    if (ja->outq != NULL)
        queue_print(ja->outq);    
        
    printf("\n");
    
    
}

activity_registry_t *activity_reg_new(char *name, char *mask, int type)
{
    activity_registry_t *reg = (activity_registry_t *)calloc(1, sizeof(activity_registry_t));
    assert(reg != NULL);
    
    strcpy(reg->name, name);
    strcpy(reg->mask, mask);
    reg->type = type;
    
    return reg;
}

bool activity_make(activitytable_t *at, char *name, char *mask, int type)
{
    int i;

    // if a registration already exists, return false
    for (i = 0; i < at->numactivityregs; i++)
        if (strcmp(at->registrations[i]->name, name) == 0)
            return false;

    // otherwise, make a new activity registration.
    at->registrations[at->numactivityregs++] = activity_reg_new(name, mask, type);

    #ifdef DEBUG_LVL1
        printf("Activity make success: %s.. made\n", name);
    #endif

    return true;
}

char *activity_get_mask(activitytable_t *at, char *name)
{
    int i;

    // Get the mask from the registration for the activity with the given name
    for (i = 0; i < at->numactivityregs; i++)
    {
        if (strcmp(at->registrations[i]->name, name) == 0)
            return at->registrations[i]->mask;
    }
    return NULL;
}


int activity_get_type(activitytable_t *at, char *name)
{
    int i;
    // Get the type from the registration for the activity with the given name

    for (i = 0; i < at->numactivityregs; i++)
    {
        if (strcmp(at->registrations[i]->name, name) == 0)
            return at->registrations[i]->type;
    }
    return -1;
}


jactivity_t *activity_new(activitytable_t *at, char *name)
{
    int i;
    jactivity_t *jact;

    // Look for the registration
    for (i = 0; i <at->numactivityregs; i++)
        if (strcmp(at->registrations[i]->name, name) == 0)
            break;
    // If the registration is not there, return NULL
    if (i == at->numactivityregs)
        return NULL;

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



jactivity_t *activity_new2(activitytable_t *at, char *name)
{
    int i;
    jactivity_t *jact;

    printf("Num activities %d\n", at->numactivities);
    
    // Look for the registration
    for (i = 0; i <at->numactivityregs; i++)
        if (strcmp(at->registrations[i]->name, name) == 0)
            break;
    // If the registration is not there, return NULL
    assert(i < at->numactivityregs);


    jact = (jactivity_t *)calloc(1, sizeof(jactivity_t));

    
  //  at->activities[0] = jact;
//    at->numactivities = 1;
    at->activities[at->numactivities++] = jact;

//    while(1);

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

  //  while(1);
    
    printf("Creating the message... \n");
    // Send a message to the background so it starts watching for messages
    command_t *cmd = command_new("ASMBL-FDS", "LOCAL", name, jact->actid, jact->actarg, "s", "__");

    printf("Sending it.. \n");
  //  while(1);
    
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

char *activity_getid(jactivity_t *jact)
{
    return jact->actid;
}

char *activity_getname(jactivity_t *jact)
{
    return jact->name;
}

void activity_start(jactivity_t *jact)
{
    jact->state = RUNNING;
}

void activity_timeout(jactivity_t *jact)
{
    jact->state = EXEC_TIMEDOUT;
}

void activity_complete_success(jactivity_t *jact)
{
    jact->state = EXEC_COMPLETE;
}

void activity_complete_error(jactivity_t *jact)
{
    jact->state = EXEC_ERROR;
}
