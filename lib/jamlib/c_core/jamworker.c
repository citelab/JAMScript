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

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY O9F ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

#include "jam.h"
#include "core.h"

#include <task.h>
#include <string.h>
#include "threadsem.h"

#include "activity.h"



// The JAM bgthread is run in another worker (pthread). Although it shares all
// the memory with the master that runs the cooperative multi-threaded application
//
// NOTE: This implementation is using the nn_poll() provided by the nano message
// library. It seems little brain dead. This should be rewritten for better performance
// from a scalability point-of-view.
//
void *jwork_bgthread(void *arg)
{
    int oldstate, oldtype;

    jamstate_t *js = (jamstate_t *)arg;

    #ifdef DEBUG_LVL1
        printf("BG Thread processor started in JAM Worker..\n");
    #endif

    // setup the thread.. make it async. cancellable
    pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, &oldstate);
    pthread_setcanceltype(PTHREAD_CANCEL_ASYNCHRONOUS, &oldtype);

    // assemble the poller.. insert the FDs that should go into the poller
    jwork_assemble_fds(js);
    // heartbeat time is set to 10000 milliseconds
    int beattime = 10000;
    thread_signal(js->bgsem);
    // get into the event processing..
    //int counter = 0;
    while (1)
    {
     //  printf("\n\n COUNTER %d \n\n", counter++);

        int nfds = jwork_wait_fds(js, beattime);
      //  printf("Activity Number After: %d\n", js->atable->numactivities);
        if (nfds == 0)
        {
            jam_send_ping(js);
            continue;
        }
        else if(nfds < 0)
            printf("\nERROR! File descriptor corruption.. another race condition??\n");

    #ifdef DEBUG_LVL1
        printf("Calling the JAM worker processor.. \n");
    #endif
        jwork_processor(js);
    }

    return NULL;
}


void jwork_reassemble_fds(jamstate_t *js, int nam)
{
    js->atable->numactivities = nam;
    jwork_assemble_fds(js);
}


// Put the FDs in a particular order..
//
//
void jwork_assemble_fds(jamstate_t *js)
{
    int i;

    // release old one..
    if (js->pollfds)
        free(js->pollfds);

    js->pollfds = (struct nn_pollfd *)calloc((4 + js->atable->numactivities), sizeof(struct nn_pollfd));

    for (i = 0; i < 4 + js->atable->numactivities; i++){
        js->pollfds[i].events = NN_POLLIN;
      }

    // pick the external sockets: REQ, PUB, and SURV
    // TODO:
    js->pollfds[0].fd = js->cstate->reqsock->sock_fd;
    js->pollfds[1].fd = js->cstate->subsock->sock_fd;
    js->pollfds[2].fd = js->cstate->respsock->sock_fd;

    // pick the output queue of the main thread .. it is the input for the bgthread
    js->pollfds[3].fd = js->atable->globaloutq->pullsock;

    // scan the number of activities and get their input queue hooked
    for (i = 0; i < js->atable->numactivities; i++)
        js->pollfds[i+4].fd = js->atable->activities[i]->outq->pullsock;
    // pollfds structure is not complete..
    js->numpollfds = 4 + js->atable->numactivities;
}


int jwork_wait_fds(jamstate_t *js, int beattime)
{
    // wait on the nn_pollfd array that is in the jamstate_t structure!
    //
    return nn_poll(js->pollfds, js->numpollfds, beattime);
}

void jwork_processor(jamstate_t *js)
{
    int i;
    // We know at least one descriptor has something for input processing
    // Need to scan all the decriptors

    // Use if constructs for the first 4 descriptors
    if (js->pollfds[0].revents & NN_POLLIN)
        jwork_process_reqsock(js);
    else
    if (js->pollfds[1].revents & NN_POLLIN)
        jwork_process_subsock(js);
    else
    if (js->pollfds[2].revents & NN_POLLIN)
        jwork_process_respsock(js);
    else
    if (js->pollfds[3].revents & NN_POLLIN)
        jwork_process_globaloutq(js);
    else
    // Use a loop to scan the rest of the descriptors
    for (i = 4; i < js->numpollfds; i++)
    {
        if (js->pollfds[i].revents & NN_POLLIN)
            jwork_process_actoutq(js, i - 4);
    }
}


void jwork_process_reqsock(jamstate_t *js)
{
    // reqsock has input that is replies to what the main thread or an
    // activity might have requested. We need to distinguish that and route
    // the reply to the appropriate destination
    //
    // TODO: What about the timeout value.. it could be inconsequential
    #ifdef DEBUG_LVL1
    printf("----- In request sock.......... \n");
    #endif
    command_t *rcmd = socket_recv_command(js->cstate->reqsock, 5000);
    #ifdef DEBUG_LVL1
    printf("Command %s, %s\n", rcmd->cmd, rcmd->actname);
    #endif
    if (rcmd != NULL)
    {
        if (strcmp(rcmd->actname, "EVENTLOOP") == 0)
        {
            // Send it to the main thread and unblock the thread
            printf("Event Loop Detected ........\n");
            queue_enq(js->atable->globalinq, rcmd, sizeof(command_t));
            thread_signal(js->atable->globalsem);
        }
        else
        if (strcmp(rcmd->actname, "ACTIVITY") == 0)
        {
            jactivity_t *jact = activity_getbyid(js->atable, rcmd->actid);
            #ifdef DEBUG_LVL1
            printf("Activity Detected ........\n");
            #endif
            // Send it to the activity and unblock the activity
            queue_enq(jact->inq, rcmd, sizeof(command_t));
            thread_signal(jact->sem);
        }
        else if (strcmp(rcmd->actname, "PINGER") == 0)
        {
            if (strcmp(rcmd->cmd, "PONG") == 0){
                #ifdef DEBUG_LVL1
                printf("Reply received for ping..\n");
                #endif
              }
            command_free(rcmd);
        }
    }
}


// Subscribe socket processing
// REXEC processing is done here.
//
void jwork_process_subsock(jamstate_t *js)
{
    // Data is available in the socket..  so timeout value
    // does not make much difference!
    //
    #ifdef DEBUG_LVL1
    printf("===================== In subsock processing...\n");
    #endif
    command_t *rcmd = socket_recv_command(js->cstate->subsock, 100);
    //printf("Command %s, actid %s.. actname %s\n", rcmd->cmd, rcmd->actid, rcmd->actname);

    if (rcmd != NULL)
    {
        if (strcmp(rcmd->cmd, "REXEC-CALL") == 0)
        {
            // No distinction is made between the SYNC and ASYNC calls here.
            // They are both passed to the jam_event_loop in jam.c
            // There we separate the two and process them differently.
            /*
            if (jwork_runtable_check(js->rtable, rcmd))
            {
                printf("Duplicate found... \n");
                command_free(rcmd);
                return;
            }*/

            if (jam_eval_condition(rcmd->actarg))
            {

                queue_enq(js->atable->globalinq, rcmd, sizeof(command_t));
                thread_signal(js->atable->globalsem);
                // rcmd is released in the main thread after consumption
            }
            else
                command_free(rcmd);
        }
    }
}


void jwork_process_respsock(jamstate_t *js)
{
    // Data is available in the socket.. so timeout value
    // is not critical.. why wait for timeout?
    //
    command_t *rcmd = socket_recv_command(js->cstate->respsock, 5000);
    printf("====================================== In respsock processing.. cmd: %s, opt: %s\n", rcmd->cmd, rcmd->opt);

    if (rcmd != NULL)
    {
        // We can respond to different types of survey questions..
        // STATUS ACTIVITY actname actarg
        if (strcmp(rcmd->cmd, "REPORT-REQ") == 0 &&
            strcmp(rcmd->opt, "SYN") == 0)
        {
            command_t *result = jwork_runid_status(js, rcmd->actarg);
            if (result != NULL)
            {
                socket_send(js->cstate->respsock, result);
                command_free(result);
            }
        }
        else
        if (strcmp(rcmd->cmd, "RKILL") == 0 &&
            strcmp(rcmd->opt, "FOG") == 0)
        {
            command_t *result = jwork_runid_kill(js, rcmd->actarg);
            socket_send(js->cstate->respsock, result);
            command_free(result);
        }
        else
        if (strcmp(rcmd->cmd, "DSTATUS") == 0 &&
            strcmp(rcmd->cmd, "REQ") == 0)
        {
            command_t *result = jwork_device_status(js);
            socket_send(js->cstate->respsock, result);
            command_free(result);
        }
        else
            command_free(rcmd);
    }
}


void jwork_process_globaloutq(jamstate_t *js)
{
    nvoid_t *nv = queue_deq(js->atable->globaloutq);
    if (nv == NULL) return;

    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    // Don't use nvoid_free() .. it is not deep enough

    if (rcmd != NULL)
    {
        #ifdef DEBUG_LVL1
        printf("Processing cmd: from GlobalOutQ.. ..\n");
        #endif
        // Many commands are in the output queue of the main thread
        if (strcmp(rcmd->opt, "LOCAL") == 0)
        {
            //printf("Processing........... %s \n", rcmd->cmd);

            if (strcmp(rcmd->cmd, "COMPL-ACT") == 0)
            {
                if (rcmd->nargs == 0)
                    jwork_runid_complete(js->rtable, rcmd->actarg, NULL);
                else
                    jwork_runid_complete(js->rtable, rcmd->actarg, &rcmd->args[0]);
                    // TODO: Could there be a memory deallocation problem in the above line?

                thread_signal(js->atable->delete_sem);
            }
            else
            {
                jwork_reassemble_fds(js, rcmd->args[0].val.ival);
                if (strcmp(rcmd->cmd, "DELETE-FDS") == 0)
                {
                    thread_signal(js->atable->delete_sem);
                }
            }
        }
        else
            socket_send(js->cstate->reqsock, rcmd);

      command_free(rcmd);
    }
}


//
// TODO: There is huge inefficiency here. We are encoding and decoding the data
// unnecessarily. We should just do pointer passing through the queue.
// Pointer could be referring to the command structure that was created by the
// activity in this case and the main thread in the above case..
//

void jwork_process_actoutq(jamstate_t *js, int indx)
{
    //printf("Indx %d\n", indx);

    nvoid_t *nv = queue_deq(js->atable->activities[indx]->outq);
    if (nv == NULL) return;

    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    // Don't use nvoid_free() .. it is not deep enough

    if (rcmd != NULL)
    {
        socket_send(js->cstate->reqsock, rcmd);
        command_free(rcmd);
    }
}



void jam_send_ping(jamstate_t *js)
{
    command_t *scmd;

    // create a command structure for the PING.
    scmd = command_new("PING", "DEVICE", "PINGER", js->cstate->conf->device_id, js->cstate->conf->device_name, "s", "temp");

    // send it through the request-reply socket.. we need to get the reply back to prevent
    // socket from going haywire
    //
    socket_send(js->cstate->reqsock, scmd);
    command_free(scmd);
}


void tcallback(void *arg)
{
    jactivity_t *jact = (jactivity_t *)arg;

    #ifdef DEBUG_LVL1
    printf("Callback.... \n");
    #endif
    // stick the "TIMEOUT" message into the queue for the activity
    command_t *tmsg = command_new("TIMEOUT", "__", "ACTIVITY", jact->actid, "__", "");
    queue_enq(jact->inq, tmsg, sizeof(command_t));
    // do a signal on the thread semaphore for the activity
    #ifdef DEBUG_LVL1
    printf("Callback Occuring... \n");
    #endif
    thread_signal(jact->sem);
}


void jam_set_timer(jamstate_t *js, char *actid, int tval)
{
    jactivity_t *jact = activity_getbyid(js->atable, actid);
    if (jact != NULL)
        timer_add_event(js->maintimer, tval, 0, actid, tcallback, jact);
}


void jam_clear_timer(jamstate_t *js, char *actid)
{
    timer_del_event(js->maintimer, actid);
}


// This is evaluating a JavaScript expression for the nodal predicate
// TODO: Fix this.. this incomplete.
//
bool jam_eval_condition(char *expr)
{
    return true;
}



// Create the runtable that contains all the runid entries.
//
runtable_t *jwork_runtable_new()
{
    runtable_t *rtab = (runtable_t *)calloc(1, sizeof(runtable_t));

    rtab->numruns = 0;

    return rtab;
}


// Check the runtable for entry (with the same runid) presence.
// If the entry is found, return true. If not return false.
// Also, this one creates a new entry if the entry is not found.
//
// TODO: This is a fixed size array of entries.. We need a better
// structure to accommodate large number of concurrent activities.
// At this point, we are limited to MAX_RUN_ENTRIES
//
bool jwork_runtable_check(runtable_t *rtable,  command_t *cmd)
{
    int i;

    for (i = 0; i < rtable->numruns; i++)
    {
        if (strcmp(rtable->entries[i]->runid, cmd->actid) == 0)
            return true;
    }

    if (rtable->numruns >= MAX_RUN_ENTRIES)
    {
        printf("\n\nFATAL ERROR!! Maximum number of concurrent entries reached.\n\n");
        exit(1);
    }

    runtableentry_t *ren = (runtableentry_t *)calloc(1, sizeof(runtableentry_t));
    rtable->entries[rtable->numruns++] = ren;

    // Yes, the runid is coming in the 'actid' field.. so this is not a bug!
    // Check the Messages.txt file for the format of the messages.
    //
    ren->runid  = strdup(cmd->actid);
    ren->actname = strdup(cmd->actname);

    // The following initializations are not necessary because of calloc initialization.
    // But.. included for clarity
    ren->code = NULL;
    ren->actid = NULL;
    ren->status = NEW;

    return false;
}


command_t *jwork_runid_status(jamstate_t *js, char *runid)
{
    command_t *scmd;
    int i;

    char *deviceid = js->cstate->conf->device_id;

    printf("Devide id %s\n", deviceid);

    // search for the runtime entry..
    for (i = 0; i < js->rtable->numruns; i++)
    {
        if (strcmp(js->rtable->entries[i]->runid, runid) == 0)
            break;
    }

    // if not found, then return NULL
    if (i >= js->rtable->numruns)
        return NULL;

    printf("I = %d.. Numruns %d........ \n", i, js->rtable->numruns);


    runtableentry_t *ren = js->rtable->entries[i];

    // create the command to reply with the status update..
    // send [[ REPORT-REP FIN actname deviceid runid res (arg0)] (res is a single object) or
    //
    if (ren->status == EXEC_COMPLETE)
    {
        if (ren->code == NULL)
        {
            scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "");
            printf("Scmd.. ....................\n");

            return scmd;
        }

        switch (ren->code->type)
        {
            case STRING_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "s", ren->code->val.sval);
            break;

            case INT_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "i", ren->code->val.ival);
            break;

            case DOUBLE_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "d", ren->code->val.dval);
            break;

            case NVOID_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "b", ren->code->val.nval);
            break;
        }
        printf("Returning....\n");
        return scmd;
    }

    return NULL;
}


// This emthod is going to be used to complete with success or flag error
// for the runid.. this is done just before the activity deletion..
//
void jwork_runid_complete(runtable_t *rtab, char *runid, arg_t *arg)
{
    int i;

    // search for the runtime entry..
    for (i = 0; i < rtab->numruns; i++)
    {
        if (strcmp(rtab->entries[i]->runid, runid) == 0)
            break;
    }

    // if not found, then return
    if (i >= rtab->numruns)
        return;

    runtableentry_t *ren = rtab->entries[i];

    ren->status = EXEC_COMPLETE;
    ren->code = arg;
    printf("RRRRRRRRRRR===============================================\n");
}


command_t *jwork_device_status(jamstate_t *js)
{
    // Get the number of activities running on the device
    return NULL;
}

command_t *jwork_runid_kill(jamstate_t *js, char *runid)
{
    return NULL;
}
