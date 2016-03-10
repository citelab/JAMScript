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

#include <stdbool.h>
#include <stdint.h>

typedef struct _jactivity_t
{
    int64_t actid;
    int state;
    char name[MAX_NAME_LEN];
    nvoid_t *code;

} jactivity_t;


typedef struct _activitytable_t
{
    int numactivities;
    jactivity_t *activities;

} activitytable_t;


//
// Function prototypes..
//

activitytable_t *at = activity_table_new();
void activity_table_print(activitytable_t *at);

jactivity_t *activity_new(activitytable_t *atbl, char *name);
int64_t activity_getid(activitytable_t *atbl, char *name);
char *activity_getname(activitytable_t *atbl, int64_t id);

bool activity_start(jactivity_t *act);
bool activity_stop(jactivity_t *act, nvoid_t *rcode);
bool activity_fail(jactivity_t *act, nvoid_t *ecode);


#endif
