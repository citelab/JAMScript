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


uint64_t activity_gettime()
{
    #ifdef __APPLE__
    return mach_absolute_time();
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
    atbl->activityslots = ALLOCATE_SLICE;
    atbl->activityregslots = ALLOCATE_SLICE;

    atbl->activities = (jactivity_t *)calloc(atbl->activityslots, sizeof(jactivity_t));
    atbl->registrations = (activity_registry_t *)calloc(atbl->activityregslots, sizeof(activity_registry_t));

    return atbl;
}

void activity_table_print(activitytable_t *at)
{
    int i;

    printf("\n");
    printf("Activity registrations: slots [%d], filled [%d]\n", at->activityregslots, at->numactivityregs);
    printf("Activity instances: slots [%d], filled [%d]\n", at->activityslots, at->numactivities);
    printf("Registrations::\n");
    for (i = 0; i < at->numactivityregs; i++)
        activity_reg_print(&(at->registrations[i]));

    printf("Activity instances::\n");
    for (i = 0; i < at->numactivities; i++)
        activity_print(&(at->activities[i]));

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
    printf("Activity ID: %llu\n", ja->actid);
    printf("Activity state: %d\n", ja->state);
    printf("Activity name: %s\n", ja->name);
    nvoid_print(ja->code);
    printf("\n");
}

bool activity_make(activitytable_t *at, char *name, char *mask, int type)
{
    int i;

    // if a registration already exists, return false
    for (i = 0; i < at->numactivityregs; i++)
        if (strcmp(at->registrations[i].name, name) == 0)
            return false;

    // otherwise, we insert the registration and return true
    if ((at->activityregslots - at->numactivityregs) < ALLOCATE_SLICE/2)
        at->registrations = realloc(at->registrations,
                        sizeof(activity_registry_t) * (at->activityregslots + ALLOCATE_SLICE));

    activity_registry_t *areg = &(at->registrations[at->numactivityregs++]);
    strcpy(areg->name, name);
    strcpy(areg->mask, mask);
    areg->type = type;

    return true;
}

char *activity_get_mask(activitytable_t *at, char *name)
{
    int i;

    // Get the mask from the registration for the activity with the given name
    for (i = 0; i < at->numactivityregs; i++)
    {
        if (strcmp(at->registrations[i].name, name) == 0)
            return at->registrations[i].mask;
    }
    return NULL;
}


int activity_get_type(activitytable_t *at, char *name)
{
    int i;
    // Get the type from the registration for the activity with the given name

    for (i = 0; i < at->numactivityregs; i++)
    {
        if (strcmp(at->registrations[i].name, name) == 0)
            return at->registrations[i].type;
    }
    return -1;
}


jactivity_t *activity_new(activitytable_t *at, char *name)
{
    int i;
    jactivity_t *jact;

    // Look for the registration
    for (i = 0; i <at->numactivityregs; i++)
        if (strcmp(at->registrations[i].name, name) == 0)
            break;
    // If the registration is not there, return NULL
    if (i == at->numactivityregs)
        return NULL;

    // Look for a deleted slot.. if available, we reuse it.
    for (i = 0; i < at->numactivities; i++)
        if (at->activities[i].state == DELETED)
            break;

    // Create a new slot if a deleted one is not found
    if (i == at->numactivities)
    {
        if ((at->activityslots - at->numactivities) < ALLOCATE_SLICE/2)
            at->activities = realloc(at->activities,
                            sizeof(jactivity_t) * (at->activityslots + ALLOCATE_SLICE));

        jact = &(at->activities[at->numactivities++]);
    }
    else
        jact = &(at->activities[i]);

    // Setup the new activity
    jact->state = NEW;
    strcpy(jact->name, name);
    jact->code = NULL;
    bzero(&(jact->sem), sizeof(Rendez));
    jact->actid = activity_gettime();

    // Setup the I/O queues
    jact->inq = queue_new(true);
    jact->outq = queue_new(true);

    // return the pointer
    return jact;
}


jactivity_t *activity_getbyid(activitytable_t *at, uint64_t actid)
{
    int i;

    for (i = 0; i < at->numactivities; i++)
    {
        if (at->activities[i].state == DELETED)
            continue;
        if (at->activities[i].actid == actid)
            return &(at->activities[i]);
    }
    return NULL;
}

void activity_del(activitytable_t *at, jactivity_t *jact)
{
    // delete the queues..
    queue_delete(jact->inq);
    queue_delete(jact->outq);

    jact->state = DELETED;
    // TODO: The memory is not touched.. may be we need to resize the memory pool if
    // the number of activities goes below a certain number?
}


int64_t activity_getid(jactivity_t *jact)
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
    jact->state = TIMEDOUT;
}

void activity_complete_success(jactivity_t *jact)
{
    jact->state = COMPLETED;
}

void activity_complete_error(jactivity_t *jact)
{
    jact->state = ERROR;
}
