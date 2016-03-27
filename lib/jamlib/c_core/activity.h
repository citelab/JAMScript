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

#include <stdbool.h>
#include <stdint.h>

#define MAX_NAME_LEN            64
#define MAX_MASK_LEN            64
#define ALLOCATE_SLICE          32

enum activity_state_t
{
    NEW,
    RUNNING,
    TIMEDOUT,
    COMPLETED,
    ERROR,
    DELETED
};


typedef struct _jactivity_t
{
    enum activity_state_t state;
    char name[MAX_NAME_LEN];
    int64_t actid;
    nvoid_t *code;
    Rendez  sem;
    simplequeue_t *inq;
    simplequeue_t *outq;

} jactivity_t;


typedef struct _activity_registry_t
{
    char name[MAX_NAME_LEN];
    char mask[MAX_MASK_LEN];
    int type;
    // function pointers are not needed.. generic representation is troublesome too
} activity_registry_t;


typedef struct _activitytable_t
{
    int numactivityregs;
    int numactivities;
    activity_registry_t *registrations;
    jactivity_t *activities;
    int activityslots;
    int activityregslots;

} activitytable_t;


//
// Function prototypes..
//
activitytable_t *activity_table_new();
void activity_table_print(activitytable_t *at);

bool activity_make(activitytable_t *at, char *name, char *mask, int type);
char *activity_get_mask(activitytable_t *at, char *name);
int activity_get_type(activitytable_t *at, char *name);

void activity_reg_print(activity_registry_t *areg);
void activity_print(jactivity_t *ja);

jactivity_t *activity_new(activitytable_t *atbl, char *name);
jactivity_t *activity_getbyid(activitytable_t *at, uint64_t actid);
int64_t activity_getid(jactivity_t *jact);
char *activity_getname(jactivity_t *jact);

void activity_start(jactivity_t *act);
void activity_timeout(jactivity_t *act);
void activity_complete_success(jactivity_t *act);
void activity_complete_error(jactivity_t *act);

#endif
