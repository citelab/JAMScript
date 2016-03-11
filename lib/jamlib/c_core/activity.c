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


#include "activity.h"
#include "nvoid.h"



activitytable_t *activity_table_new()
{
    activitytable_t *atbl = (activitytable_t *)calloc(1, sizeof(activitytable_t));
    assert(atbl != NULL);

    atbl->numactivities = 0;
    atbl->activityslots = ACTIVITY_SLICE;
    atbl->activities = (jactivity_t *)calloc(atbl->activityslots, sizeof(jactivity_t));

    return atbl;
}


void activity_table_print(activitytable_t *at)
{
    int i;

    printf("\n");
    printf("Activity table size: %d\n", at->activityslots);
    printf("Slots filled: %d\n", at->numactivities);
    printf("==========\n");
    for (i = 0; i < at->numactivities; i++)
        activity_print(&(at->activities[i]));

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

jactivity_t *activity_new(activitytable_t *atbl, char *name)
{
    jactivity_t *jact = (jactivity_t *)calloc(1, sizeof(jactivity_t));
    arc4random_buf(&jact->actid, 8);
    jact->state = NEW;
    strcpy(jact->name, name);
    jact->code = NULL;

    return jact;
}


jactivity_t *activity_getbyid(activitytable_t *atbl, int64_t id)
{
    int i;

    for (i = 0; i < atbl->numactivities; i++)
    {
        if (atbl->activities[i].actid == id)
            return &(atbl->activities[i]);

    }

    return NULL;
}

jactivity_t *activity_getbyname(activitytable_t *atbl, char *name)
{
    int i;

    for (i = 0; i < atbl->numactivities; i++)
    {
        if (strcmp(atbl->activities[i].name, name) == 0)
            return &(atbl->activities[i]);

    }

    return NULL;
}


bool activity_start(jactivity_t *act)
{
    act->state = RUNNING;
    return true;
}


bool activity_stop(jactivity_t *act, nvoid_t *rcode)
{
    act->state = STOPPED;
    act->code = rcode;
    return true;
}


bool activity_fail(jactivity_t *act, nvoid_t *ecode)
{
    act->state = FAILED;
    act->code = ecode;
    return true;
}
