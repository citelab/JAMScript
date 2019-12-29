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
    //
    // TODO: Is this back pointer necessary?
    atbl->jarg = jarg;

    atbl->jcounter = 1;
    atbl->numcbackregs = 0;

    for (i = 0; i < MAX_CALLBACKS; i++)
        atbl->callbackregs[i] = NULL;

    for (i = 0; i < MAX_ACT_THREADS; i++)
        atbl->athreads[i] = athread_init(atbl);

    // globalinq is used by the main thread for input purposes
    // globaloutq is used by the main thread for output purposes
    atbl->globalinq = p2queue_new(false);
    atbl->globaloutq = queue_new(false);
    // create the linked list to hold the activities
    atbl->alist = create_list();

    pthread_mutex_init(&(atbl->lock), NULL);

    return atbl;
}


void activity_printthread(activity_thread_t *ja)
{
    printf("\n");
    printf("Activity ID: %d\n", ja->threadid);
    printf("Activity state: %d\n", ja->jindx);

    printf("\n");
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



bool activity_regcallback(activity_table_t *at, char *name, int type, char *sig, activitycallback_f cback)
{
    int i;

    // if a registration already exists, return false
    pthread_mutex_lock(&(at->lock));
    for (i = 0; i < at->numcbackregs; i++)
        if (strcmp(at->callbackregs[i]->name, name) == 0)
        {
            pthread_mutex_unlock(&(at->lock));
            return false;
        }
    pthread_mutex_unlock(&(at->lock));

    // otherwise, make a new activity registration.
    activity_callback_reg_t *creg = (activity_callback_reg_t *)calloc(1, sizeof(activity_callback_reg_t));
    strcpy(creg->name, name);
    strcpy(creg->signature, sig);
    creg->type = type;
    creg->cback = cback;

    pthread_mutex_lock(&(at->lock));
    at->callbackregs[at->numcbackregs++] = creg;
    pthread_mutex_unlock(&(at->lock));

    #ifdef DEBUG_LVL1
        printf("Activity make success: %s.. made\n", name);
    #endif

    return true;
}


activity_callback_reg_t *activity_findcallback(activity_table_t *at, char *name)
{
    int i;

    pthread_mutex_lock(&(at->lock));
    for (i = 0; i < at->numcbackregs; i++)
    {
        if (strcmp(at->callbackregs[i]->name, name) == 0)
        {
            pthread_mutex_unlock(&(at->lock));
            return at->callbackregs[i];
        }
    }
    pthread_mutex_unlock(&(at->lock));

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

    jamstate_t *js = (jamstate_t *)at->jarg;
    activity_callback_reg_t *areg;
    athread->taskid = taskid();

    jactivity_t *jact;
    while (1)
    {
        arg_t *repcode = NULL;
        command_t *cmd;
        nvoid_t *nv = pqueue_deq(athread->inq);

        // The jactivity that is assigned to the the thread is in 'jactid'
        int jindx = athread->jindx;

        // Something is wrong.. we just got a spurious thread wakeup ... why??
        if (jindx == 0)
            continue;

        // Get the command that woke up the thread.. this has the work to do
        if (nv != NULL)
        {
            cmd = (command_t *)nv->data;
            free(nv);
        } else
            cmd = NULL;

        if (cmd != NULL)
        {
            jact = activity_getbyindx(at, jindx);
            if (jact == NULL)
                continue;

            // If the activity is local.. we check whether this is servicing JSYNC task processing
            if ((!jact->remote) && (strcmp(cmd->cmd, "LEXEC-ASY") == 0))
            {
                activity_callback_reg_t *creg = activity_findcallback(js->atable, cmd->actname);
                creg->cback(jact, cmd);
                activity_free(jact);
            }
            else
            if ((!jact->remote) && jact->type == SYNC_RTE)
            {
                jam_clear_timer(js, jact->actid);
                // We got the ack for the SYNC request..
                if ((strcmp(cmd->cmd, "TIMEOUT") != 0) && (strcmp(cmd->cmd, "REXEC-NAK") != 0))
                {
                    // We received the acknowledgement for the SYNC.. now proceed to the next stage.
                    int timeout = 900;
                    printf("------------------1--------\n");
                    jam_set_timer(js, jact->actid, timeout);
                    nv = pqueue_deq(athread->inq);
                    jam_clear_timer(js, jact->actid);

                    cmd = NULL;
                    if (nv != NULL)
                    {
                        cmd = (command_t *)nv->data;
                        free(nv);

                        if (strcmp(cmd->cmd, "REXEC-RES") == 0)
                        {
                            // We create a structure to hold the result returned by the root
                            repcode = (arg_t *)calloc(1, sizeof(arg_t));
                            command_arg_copy(repcode, &(cmd->args[0]));

                            // Push the reply.. into the reply queue..
                            pqueue_enq(athread->resultq, repcode, sizeof(arg_t));
                        } else 
                            pqueue_enq(athread->resultq, NULL, 0);
                    } else 
                        pqueue_enq(athread->resultq, NULL, 0);

                }
                else
                {
                    // We did not receive the ack.. so we generate a NULL reply and push it to
                    // the reply queue.
                    pqueue_enq(athread->resultq, NULL, 0);
                }
            }
            else
            if ((!jact->remote) && jact->type == SYNC_NRT)
            {
                jam_clear_timer(js, jact->actid);
                bool ack_failed = false;
                for (int i = 0; i < machine_height(js) -1; i++)
                {
                    if ((strcmp(cmd->cmd, "TIMEOUT") == 0) || (strcmp(cmd->cmd, "REXEC-NAK") == 0))
                        ack_failed = true;

                    if (i < machine_height(js) -2)
                    {
                        int timeout = 300;
                        printf("------------------2--------\n");
                        jam_set_timer(js, jact->actid, timeout);
                        nv = pqueue_deq(athread->inq);
                        jam_clear_timer(js, jact->actid);

                        if (nv != NULL)
                        {
                            cmd = (command_t *)nv->data;
                            free(nv);
                        }
                    }
                }

                int results;
                if (!ack_failed)
                    results = 1;
                else
                    results = 0;
                pqueue_enq(athread->resultq, &results, sizeof(int));
            }
            else
            if ((!jact->remote) && jact->type == ASYNC)
            {
                jam_clear_timer(js, jact->actid);
                bool ack_failed = false;

                for (int i = 0; i < machine_height(js) -1 ; i++)
                {
                    if ((strcmp(cmd->cmd, "TIMEOUT") == 0) || (strcmp(cmd->cmd, "REXEC-NAK") == 0))
                        ack_failed = true;

                    if (i < machine_height(js) -2)
                    {
                        int timeout = 300;
                        printf("------------------3--------\n");                        
                        jam_set_timer(js, jact->actid, timeout);
                        nv = pqueue_deq(athread->inq);
                        jam_clear_timer(js, jact->actid);

                        if (nv != NULL)
                        {
                            cmd = (command_t *)nv->data;
                            free(nv);
                        }
                    }
                }

                int results;
                if (!ack_failed)
                    results = 1;
                else
                    results = 0;
                pqueue_enq(athread->resultq, &results, sizeof(int));
            }
            else
            {
                if (strcmp(cmd->cmd, "REXEC-ASY") == 0) 
                {
                    areg = activity_findcallback(at, cmd->actname);
                    if (areg == NULL)
                        printf("Function not found.. %s\n", cmd->actname);
                    else
                    {
                        #ifdef DEBUG_LVL1
                            printf("Command actname = %s %s %s\n", cmd->actname, cmd->cmd, cmd->opt);
                        #endif
                        jrun_arun_callback(jact, cmd, areg);
                        #ifdef DEBUG_LVL1
                            printf(">>>>>>> After task create...cmd->actname %s\n", cmd->actname);
                        #endif
                        // Delete the runtable entry..
                        // TODO: Do we ever need a runtable entry (even the deleted one) at a later point in time?
                        runtable_del(js->rtable, cmd->actid);
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

                        jrun_arun_callback(jact, cmd, areg);
                        #ifdef DEBUG_LVL1
                            printf(">>>>>>> After task create...cmd->actname %s\n", cmd->actname);
                        #endif
                        // Delete the runtable entry..
                        // TODO: Do we ever need a runtable entry (even the deleted one) at a later point in time?
                        runtable_del(js->rtable, cmd->actid);
                    }
                }
            }
            command_free(cmd);
        }

        // jindx = 0 means there is no active activity on the thread..
        athread->jindx = 0;
        taskyield();
    }
}


// Create a new activity thread. This is reused by the system. That is,
// it is never released.
//
activity_thread_t *athread_init(activity_table_t *atbl)
{
    static int counter = 0;
    activity_thread_t *at = (activity_thread_t *)calloc(1, sizeof(activity_thread_t));

    // Setup the dummy activity
    at->jindx = 0;
    at->threadid = counter++;

    // Setup the I/O queues
    at->inq = pqueue_new(false);
    at->outq = queue_new(false);
    at->resultq = pqueue_new(true);

    comboptr_t *ct = create_combo3_ptr(atbl, at, NULL);
    // TODO: What is the correct stack size? Remember this runs all user functions
    taskcreate(run_activity, ct, 20000);

    // return the pointer
    return at;
}


activity_thread_t *athread_getmine(activity_table_t *at)
{
    int i;
    int myid = taskid();

    // Get an EMPTY thread if available
    pthread_mutex_lock(&(at->lock));
    for (i = 0; i < MAX_ACT_THREADS; i++)
    {
        // thread found .. just return it.
        if (at->athreads[i]->taskid == myid)
        {
            pthread_mutex_unlock(&(at->lock));
            return at->athreads[i];
        }
    }

    return NULL;
}


activity_thread_t *athread_get(activity_table_t *at, int jindx)
{
    int i;

    // Get an EMPTY thread if available
    pthread_mutex_lock(&(at->lock));
    for (i = 0; i < MAX_ACT_THREADS; i++)
    {
        // thread found .. just return it.
        if (at->athreads[i]->jindx == jindx)
        {
            pthread_mutex_unlock(&(at->lock));
            return at->athreads[i];
        }
    }
    for (i = 0; i < MAX_ACT_THREADS; i++)
    {
        // Otherwise, find an empty thread..
        if (at->athreads[i]->jindx == 0)
        {
            pthread_mutex_unlock(&(at->lock));
            return at->athreads[i];
        }
    }
    pthread_mutex_unlock(&(at->lock));
    return NULL;
}



jactivity_t *activity_new(activity_table_t *at, char *actid, bool remote)
{
    activity_thread_t *athr;
    jactivity_t *jact = (jactivity_t *)calloc(1, sizeof(jactivity_t));
    jact->atable = at;

    jact->jindx = at->jcounter++;
    int count = 3;

    if (jact != NULL)
    {
        jact->remote = remote;
        while ((athr = athread_get(at, jact->jindx)) == NULL)
        {
            taskdelay(10);
            count--;
            if (count <= 0)
            {
                if (odcount > ODCOUNT_MIN)
                    odcount -= ODCOUNT_DOWNVAL;
                free(jact);
                return NULL;
            }
        }

        // Setup the thread.
        pthread_mutex_lock(&(at->lock));
        athr->jindx = jact->jindx;
        pthread_mutex_unlock(&(at->lock));

        strcpy(jact->actid, actid);
    }

    pthread_mutex_lock(&(at->lock));
    put_list_tail(at->alist, jact, sizeof(jactivity_t));
    pthread_mutex_unlock(&(at->lock));

    // return the pointer
    return jact;
}


jactivity_t *activity_renew(activity_table_t *at, jactivity_t *jact)
{
    activity_thread_t *athr = athread_get(at, jact->jindx);
    int count;

    if (athr == NULL)
    {
        // The activity does not have a thread .. we need renewal
        while ((athr = athread_get(at, jact->jindx)) == NULL)
        {
            taskdelay(10);
            // Wait until we get a thread..
            count--;
            if (count <= 0)
            {
                if (odcount > ODCOUNT_MIN)
                    odcount -= ODCOUNT_DOWNVAL;
                return NULL;
            }
        }

        // Setup the thread.
        pthread_mutex_lock(&(at->lock));
        athr->jindx = jact->jindx;
        pthread_mutex_unlock(&(at->lock));

        return jact;
    }
    else
    if (athr->jindx == jact->jindx)
        return jact;
    else
    {
        // Setup the thread.
        pthread_mutex_lock(&(at->lock));
        athr->jindx = jact->jindx;
        pthread_mutex_unlock(&(at->lock));

        return jact;
    }
}


void activity_free(jactivity_t *jact)
{
    if (jact == NULL)
        return;

    // Get a reference to the activity table..
    activity_table_t *at = jact->atable;

    pthread_mutex_lock(&(at->lock));
    del_list_item(at->alist, jact);
    pthread_mutex_unlock(&(at->lock));

    // TODO: Could there be a need for flushing?
    // Looks like we are having a "race" condition with flushing
    //
    // Get the thread held by the activity
    // activity_thread_t *athr = athread_get(at, jact->jindx);
    //
    // if (athr->jindx > 0)
    // {
    //     printf("Flusing activity jindx %d.. threadid %d \n", athr->jindx, athr->threadid);
    //     // We need to flush
    //     command_t *tmsg = command_new("FLUSH", "-", "-", 0, "ACTIVITY", jact->actid, "__", "");
    //     pqueue_enq(athr->inq, tmsg, sizeof(command_t));
    //     printf(".........Flusing activity jindx %d.. threadid %d \n", athr->jindx, athr->threadid);
    // }

    if (odcount < ODCOUNT_MAX)
        odcount += ODCOUNT_UPVAL;
    free(jact);
}



activity_thread_t *athread_getbyindx(activity_table_t *at, int jindx)
{
    // Only return non NULL if the activity has a thread
    activity_thread_t *athr = athread_get(at, jindx);
    if (athr->jindx == jindx)
        return athr;
    else
        return NULL;
}


int match_actid(void *elem, void *arg)
{
    jactivity_t *jact = (jactivity_t *)elem;
    if (jact == NULL)
        return -1;

    return strcmp(jact->actid, (char *)arg);
}


activity_thread_t *athread_getbyid(activity_table_t *at, char *actid)
{
    pthread_mutex_lock(&(at->lock));
    jactivity_t *jact = search_item(at->alist, actid, match_actid);
    pthread_mutex_unlock(&(at->lock));

    if (jact == NULL)
        return NULL;

    // Only return non NULL if the activity has a thread
    activity_thread_t *athr = athread_get(at, jact->jindx);
    if (athr->jindx == jact->jindx)
        return athr;
    else
        return NULL;
}


int match_jindx(void *elem, void *arg)
{
    jactivity_t *jact = (jactivity_t *)elem;
    if (jact == NULL)
        return -1;

    if (jact->jindx == *(int *)arg)
        return 0;
    else
        return -1;
}

jactivity_t *activity_getbyid(activity_table_t *at, char *actid)
{
    pthread_mutex_lock(&(at->lock));
    jactivity_t *jact = search_item(at->alist, actid, match_actid);
    pthread_mutex_unlock(&(at->lock));
    if (jact == NULL)
        return NULL;

    // Only return non NULL if the activity has a thread
    activity_thread_t *athr = athread_get(at, jact->jindx);
    if (athr->jindx == jact->jindx)
        return jact;
    else
        return NULL;
}

jactivity_t *activity_getbyindx(activity_table_t *at, int jindx)
{
    jactivity_t *jact;
    pthread_mutex_lock(&(at->lock));
    jact = search_item(at->alist, (char *)&jindx, match_jindx);
    pthread_mutex_unlock(&(at->lock));

    return jact;
}

void activity_complete(activity_table_t *at, char *opt, char *actid, char *fmt, ...)
{
    va_list args;
    arg_t *qarg;

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
        jwork_send_results(js, opt, re->actname, re->actid, qarg);

}
