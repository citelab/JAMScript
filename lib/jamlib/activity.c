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
#ifdef linux
#include <time.h>
#endif
#include <task.h>
#include <sys/time.h>

#include "activity.h"
#include "nvoid.h"
#include "comboptr.h"

#include "jam.h"

//
// jactivity is created as follows:
//     = created for the main thread - main program - this 
//         used to run the program and all the synchronous functions
//     = created for each asynchronous functions

//     = created for each remote function call 

// jactivity is deleted as follows:
//     = main thread is only deleted when the program is terminated 
//     = asynchronous functions - deleted by the user program 

//     = deleted by the remote function call 

// What happens at creation?
//     = Allocate memory for the activity structure
//     = Get a free thread from the pool 
//     = Set the thread to the activity 
//     = Activity ID should be set in both thread and activity structures
//     = State is set to NEW in the activity 

// What happens at deletion?
//     = Disassociate the thread from the activity: needs to be done in the thread and activity 
//     = Release activity ID by releasing the memory and setting the pointer to NULL
//


char *activity_gettime(char *prefix)
{
    char buf[64];
    #ifdef __APPLE__
        if (prefix == NULL)
            sprintf(buf, "%llu", mach_absolute_time());
        else 
            sprintf(buf, "%s%llu", prefix, mach_absolute_time());
        return strdup(buf);
    #endif

    #ifdef linux
        struct timespec tp;
        clock_gettime(CLOCK_MONOTONIC, &tp);
        if (prefix == NULL)
            sprintf(buf, "%li%li", tp.tv_sec, tp.tv_nsec);
        else 
            sprintf(buf, "%s%li%li", prefix, tp.tv_sec, tp.tv_nsec);
        return strdup(buf);
    #endif
    return 0;
}


long long activity_getseconds()
{
    struct timeval tp;

    if (gettimeofday(&tp, NULL) < 0)
    {
        printf("ERROR!! Getting system time..");
        return 0;
    }

    return tp.tv_sec * 1000000LL + tp.tv_usec;
}


long activity_getuseconds()
{
    struct timeval tp;

    if (gettimeofday(&tp, NULL) < 0)
    {
        printf("ERROR!! Getting system time..");
        return 0;
    }

    return tp.tv_usec;
}


activity_table_t *activity_table_new(void *jarg)
{
    int i;

    activity_table_t *atbl = (activity_table_t *)calloc(1, sizeof(activity_table_t));
    assert(atbl != NULL);
    atbl->jarg = jarg;

    atbl->runcounter = 0;
    atbl->numcbackregs = 0;

    for (i = 0; i < MAX_CALLBACKS; i++)
        atbl->callbackregs[i] = NULL;

    for (i = 0; i < MAX_ACT_THREADS; i++)
        atbl->athreads[i] = activity_initthread(atbl);

    // globalinq is used by the main thread for input purposes
    // globaloutq is used by the main thread for output purposes
    atbl->globalinq = p2queue_new(true);
    atbl->globaloutq = queue_new(true);

    return atbl;
}

void activity_table_print(activity_table_t *at)
{
    int i;

    printf("\n");
    printf("Activity callback regs.: [%d] \n", at->numcbackregs);
    printf("Registrations::\n");

    for (i = 0; i < at->numcbackregs; i++)
        activity_callbackreg_print(at->callbackregs[i]);

    printf("Activity instances::\n");
    for (i = 0; i < MAX_ACT_THREADS; i++)
        activity_printthread(at->athreads[i]);

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


void activity_printthread(activity_thread_t *ja)
{
    if (ja->state == EMPTY)
        return;

    printf("\n");
    printf("Activity ID: %s\n", ja->actid);
    printf("Activity state: %d\n", ja->state);

    printf("\n");
}

bool activity_regcallback(activity_table_t *at, char *name, int type, char *sig, activitycallback_f cback)
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


activity_callback_reg_t *activity_findcallback(activity_table_t *at, char *name)
{
    int i;

    for (i = 0; i < at->numcbackregs; i++) 
    {
        if (strcmp(at->callbackregs[i]->name, name) == 0)
            return at->callbackregs[i];
    }

    return NULL;
}


// This is the runner for the activity. Each activity is running this 
// on its task. It loads the newly arriving request and starts the corresponding 
// function
//
void run_activity(void *arg)
{
    activity_table_t *at = ((comboptr_t *)arg)->arg1;
    activity_thread_t *athread = ((comboptr_t *)arg)->arg2;
    free(arg);

    activity_callback_reg_t *areg;

    athread->taskid = taskid();
    while (1) 
    {
        command_t *cmd;
        nvoid_t *nv = pqueue_deq(athread->inq);
        if (athread->jact == NULL)
        {
            // Something is wrong.. we just got a thread woken without any activity..
            athread->state = EMPTY;
            continue;
        }

        athread->state = STARTED;
        if (nv != NULL)
        {
            cmd = (command_t *)nv->data;
            free(nv);
        } else
            cmd = NULL;

        if (cmd != NULL)
        {
            if ((strcmp(cmd->cmd, "REXEC-ASY") == 0) ||
                (strcmp(cmd->cmd, "REXEC-ASY-CBK") == 0))
            {
                areg = activity_findcallback(at, cmd->actname);
                if (areg == NULL)
                    printf("Function not found.. %s\n", cmd->actname);
                else 
                {
                    jactivity_t *jact = athread->jact;
                    #ifdef DEBUG_LVL1
                    printf("Command actname = %s %s %s\n", cmd->actname, cmd->cmd, cmd->opt);
                    #endif
                    jrun_arun_callback(jact, cmd, areg);
                    #ifdef DEBUG_LVL1
                    printf(">>>>>>> After task create...cmd->actname %s\n", cmd->actname);
                    #endif
                }
            }
            else 
            if (strcmp(cmd->cmd, "REXEC-SYN") == 0)
            {
                // TODO: There is no difference at this point.. what will be the difference?
                areg = activity_findcallback(at, cmd->actname);
                if (areg == NULL)
                    printf("Function not found.. %s\n", cmd->actname);
                else 
                {
                    #ifdef DEBUG_LVL1
                    printf("Command actname = %s %s %s\n", cmd->actname, cmd->cmd, cmd->opt);
                    #endif

                    jrun_arun_callback(athread->jact, cmd, areg);
                    #ifdef DEBUG_LVL1
                    printf(">>>>>>> After task create...cmd->actname %s\n", cmd->actname);
                    #endif
                }
            }
            command_free(cmd);
        }
        athread->state = EMPTY;
        taskyield();    
    }
}


// Create a new activity thread. This is reused by the system. That is,
// it is never released.
// 
activity_thread_t *activity_initthread(activity_table_t *atbl)
{
    static int counter = 0;
    activity_thread_t *at = (activity_thread_t *)calloc(1, sizeof(activity_thread_t));

    // Setup the dummy activity
    at->state = EMPTY;
    at->actid = NULL;
    at->threadid = counter++;

    // Setup the I/O queues
    at->inq = pqueue_new(true);
    at->outq = queue_new(true);

    comboptr_t *ct = create_combo3_ptr(atbl, at, NULL);
    // TODO: What is the correct stack size? Remember this runs all user functions
    taskcreate(run_activity, ct, 20000);

    // return the pointer
    return at;
}

activity_thread_t *activity_getthread(activity_table_t *at, char *actid)
{
    int i, j = -1;

    // Get an EMPTY thread if available
    for (i = 0; i < MAX_ACT_THREADS; i++)
        if (at->athreads[i]->state == EMPTY)
            return at->athreads[i];
            
    return NULL;
    
    // FIXME: Delete the rest..

    long long ctime = activity_getseconds();
    long cdiff = 0;

    // If not, replace a least recently used thread..
    for (i = 0; i < MAX_ACT_THREADS; i++)
    {
        if (at->athreads[i]->jact == NULL)
        {
            j = i;
            break;
        }
        else 
        {
            if (ctime - at->athreads[i]->jact->accesstime > cdiff) 
            {
                cdiff = ctime - at->athreads[i]->jact->accesstime;
                j = i;
            }
        }
    }
    printf("J = %d\n", j);

    if (j < 0)
        return NULL;
    else 
        return at->athreads[j];
}

void activity_setthread(activity_thread_t *at, jactivity_t *jact, char *actid)
{
    at->state = NEW;
    // TODO: There could be memory leak here.. did we release the previous one?
    at->actid = strdup(actid);
    at->jact = jact;
}



jactivity_t *activity_new(activity_table_t *at, char *actid, bool remote)
{
    int i;
    jactivity_t *jact = (jactivity_t *)calloc(1, sizeof(jactivity_t));

    if (jact != NULL) 
    {
        jact->remote = remote;
        while ((jact->thread = activity_getthread(at, actid)) == NULL)
        {
            printf("Waiting for ...\n");
            taskdelay(10);
        }

        // Setup the thread.
        activity_setthread(jact->thread, jact, actid);

        // Setup the new activity
        // NOTE:: We are not setting the thread state as above
        // So this is not repeating what was inside setthread()..
        // 
        jact->state = NEW;
        jact->actid = strdup(actid);

//      printf("Using thread ID %d for activity with ID %s Remote %d\n", jact->thread->threadid, jact->actid, remote);

        // Set the replies' pointer to NULL for good measure
        for (int i = 0; i < MAX_REPLIES; i++)
            jact->replies[i] = NULL;
    }

    // return the pointer
    return jact;
}

void activity_free(jactivity_t *jact)
{
    int i; 

//    printf("Activity free... %s\n", jact->actid);
    activity_freethread(jact);

    if (jact->actid) free(jact->actid);

    for (i = 0; i < MAX_REPLIES; i++)
    {
        if (jact->replies[i] != NULL)
            command_free(jact->replies[i]);
    }

    free(jact);
    taskyield();
}


activity_thread_t *activity_getbyid(activity_table_t *at, char *actid)
{
    int i;

    for (i = 0; i < MAX_ACT_THREADS; i++)
    {
        if ((at->athreads[i]->state != EMPTY) &&
            (strcmp(at->athreads[i]->actid, actid) == 0))
            return at->athreads[i];
    }
    return NULL;
}


// returns -1 if the activity with given actid is not there
int activity_id2indx(activity_table_t *at, char *actid)
{
    int i;

    for (i = 0; i < MAX_ACT_THREADS; i++)
    {
        if ((at->athreads[i]->state != EMPTY) &&
            (strcmp(at->athreads[i]->actid, actid) == 0))
            return i;
    }
    return -1;
} 


void activity_freethread(jactivity_t *jact)
{
    if ((jact == NULL) || (jact->thread == NULL))
        return;

    jact->thread->state = EMPTY;
    
    // Free memory that is not reuseable
    // FIXME: What is the trouble with deallocating here??
    // if (jact->thread->actid != NULL) free(jact->thread->actid);

    // disassociate the thread and activity
    jact->thread->jact = NULL;
    jact->thread = NULL;
 //   printf("Freed thread for activity %s\n", jact->actid);
}

void activity_complete(activity_table_t *at, char *actid, char *fmt, ...)
{
    va_list args;
    arg_t *qarg;
    nvoid_t *nv;

    qarg = (arg_t *)calloc(1, sizeof(arg_t));

    va_start(args, fmt);
    // switch on fmt[0]. It should not be more than one character
    switch (fmt[0])
    {
        case 's':
            qarg->val.sval = strdup(va_arg(args, char *));
            qarg->type = STRING_TYPE;
            break;

        case 'i':
            qarg->val.ival = va_arg(args, int);
            qarg->type = INT_TYPE;
            break;

        case 'd':
            qarg->val.dval = va_arg(args, double);
            qarg->type = DOUBLE_TYPE;
            break;
    }
    va_end(args);

    jamstate_t *js = (jamstate_t *)at->jarg;
    runtableentry_t *re = runtable_find(js->rtable, actid);

    if (re != NULL)
    {
        jwork_send_results(js, re->cmd, qarg);
        runtable_store_results(js->rtable, actid, qarg);
    }

}
    