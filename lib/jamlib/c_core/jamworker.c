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

    // heartbeat time is set to 1000 milliseconds    
    int beattime = 5000; 
    thread_signal(js->bgsem);
    // get into the event processing..
    while (1)
    {
        // wait on the poller
        int nfds = jwork_wait_fds(js, beattime);
        if (nfds <= 0) 
        {
            jam_send_ping(js);
            continue;
        }

    #ifdef DEBUG_LVL1
        printf("Calling the JAM worker processor.. \n");
    #endif
        jwork_processor(js);
    }

    return NULL;
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

    for (i = 0; i < 4 + js->atable->numactivities; i++)
        js->pollfds[i].events = NN_POLLIN;

    // pick the external sockets: REQ, PUB, and SURV
    // TODO:
    js->pollfds[0].fd = js->cstate->reqsock->sock_fd;
    js->pollfds[1].fd = js->cstate->subsock->sock_fd;
    js->pollfds[2].fd = js->cstate->respsock->sock_fd;

    // pick the output queue of the main thread .. it is the input for the bgthread
    js->pollfds[3].fd = js->atable->globaloutq->pullsock;

    // scan the number of activities and get their input queue hooked
    for (i = 0; i < js->atable->numactivities; i++) 
    {
        printf("Setting... i = %d\n", i);
        js->pollfds[i+4].fd = js->atable->activities[i]->outq->pullsock;
    }
    printf("DONE.................................\n");

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
    printf("----- In request sock.. \n");
    
    command_t *rcmd = socket_recv_command(js->cstate->reqsock, 5000);
    
    printf("Actname %s\n", rcmd->actname);
    
    if (rcmd != NULL)
    {
        if (strcmp(rcmd->actname, "EVENTLOOP") == 0)
        {
            // Send it to the main thread and unblock the thread
            queue_enq(js->atable->globalinq, rcmd, sizeof(command_t));
            thread_signal(js->atable->globalsem);
        }
        else
        if (strcmp(rcmd->actname, "ACTIVITY") == 0)
        {
            printf("Activity ID: %s\n", rcmd->actid);
            
            jactivity_t *jact = activity_getbyid(js->atable, rcmd->actid);
            
            // Send it to the activity and unblock the activity
            queue_enq(jact->inq, rcmd, sizeof(command_t));
            thread_signal(jact->sem);
        }
        else
        if (strcmp(rcmd->actname, "PINGER") == 0)
        {
            if (strcmp(rcmd->cmd, "PONG") == 0)
                printf("Reply received for ping..\n");
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
    printf("===================== In subsock processing...\n");
    command_t *rcmd = socket_recv_command(js->cstate->subsock, 100);
    printf("Command %s, actid %s\n", rcmd->cmd, rcmd->actid);
    
    if (rcmd != NULL)
    {
        if (strcmp(rcmd->cmd, "REXEC-CALL") == 0)
        {
            if (jwork_duplicate_call(rcmd)) 
            {
                command_free(rcmd);
                return;
            }
            
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
    printf("================= In respsock processing.. \n");
    command_t *rcmd = socket_recv_command(js->cstate->respsock, 5000);
     
    if (rcmd != NULL)
    {
        // We can respond to different types of survey questions..
        // STATUS ACTIVITY actname actarg
        if (strcmp(rcmd->cmd, "REPORT-REQ") == 0 &&
            strcmp(rcmd->opt, "FOG") == 0)
        {
            command_t *result = jwork_runid_status(js, rcmd->actarg);
            socket_send(js->cstate->respsock, result);
            command_free(result);
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
        if (strcmp(rcmd->cmd, "DSTATUS-REQ") == 0 &&
            strcmp(rcmd->cmd, "FOG") == 0)
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
        printf("Processing cmd: [%s] from GlobalOutQ\n", rcmd->cmd);
        
        // Many commands are in the output queue of the main thread
        // QCMD: ASMBL-FDS LOCAL actname actarg
        if (strcmp(rcmd->cmd, "ASMBL-FDS") == 0 &&
            strcmp(rcmd->opt, "LOCAL") == 0)
            jwork_assemble_fds(js);
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
    printf("Indx %d\n", indx);
    
    nvoid_t *nv = queue_deq(js->atable->activities[indx]->outq);
    if (nv == NULL) return;
    
    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    // Don't use nvoid_free() .. it is not deep enough 
    
    if (rcmd != NULL)
    {
        // QCMD: LOCAL DEL-ACTIVITY actname actarg
        // Otherwise, send it to the reqsock
        if (strcmp(rcmd->cmd, "LOCAL") == 0 &&
            strcmp(rcmd->opt, "DEL-ACTIVITY") == 0)
            jwork_assemble_fds(js);
        else
            socket_send(js->cstate->reqsock, rcmd);

        command_free(rcmd);
    }
}

command_t *jwork_runid_status(jamstate_t *js, char *runid)
{
    return NULL;
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

void jam_send_ping(jamstate_t *js)
{
    command_t *scmd;

    // create a request-reply socket
    scmd = command_new("PING", "DEVICE", "PINGER", js->cstate->conf->device_id, js->cstate->conf->device_name, "s", "temp");

    socket_send(js->cstate->reqsock, scmd);
    command_free(scmd);
}


void tcallback(void *arg)
{
    jactivity_t *jact = (jactivity_t *)arg;
    
    printf("Callback.... \n");
    // stick the "TIMEOUT" message into the queue for the activity
    command_t *tmsg = command_new("TIMEOUT", "__", "ACTIVITY", jact->actid, "__", "");
    queue_enq(jact->inq, tmsg, sizeof(command_t));
    // do a signal on the thread semaphore for the activity

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

bool jwork_duplicate_call(command_t *cmd)
{
    static int numentries = 0;
    static int lastentry = 0;
    static char *entries[MAX_DUP_ENTRIES];
    
    int i;
    
    for (i = 0; i < numentries; i++) 
    {
        if (strcmp(entries[i], cmd->actid) == 0)
            return true;                    
    }
    
    if (numentries < MAX_DUP_ENTRIES) 
        entries[numentries++] = strdup(cmd->actid);
    else
    {
        free(entries[lastentry]);
        entries[lastentry] = strdup(cmd->actid);
        lastentry = (lastentry + 1) % MAX_DUP_ENTRIES;
    }
    
    return false;
}
