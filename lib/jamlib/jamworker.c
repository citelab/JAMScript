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
#include "jdata.h"
#include "nvoid.h"
#include "mqtt.h"
#include "activity.h"


// The JAM bgthread is run in another worker (pthread). It shares all
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

    // Hookup the callback handlers for the different packet sources
    core_disconnect(js->cstate);
    jwork_set_callbacks(js);
    core_reconnect(js->cstate);

    // Setup the subscriptions
    jwork_set_subscriptions(js);

    // assemble the poller.. insert the FDs that should go into the poller
    jwork_assemble_fds(js);

    thread_signal(js->bgsem);
    // process the events..

    #ifdef DEBUG_LVL1
        printf("Setup done. Waiting for the messages...\n");
    #endif

    while (1)
    {
        int nfds = jwork_wait_fds(js);
        if (nfds == 0)
            continue;
        else if(nfds < 0)
            printf("\nERROR! File descriptor corruption.. another race condition??\n");

        #ifdef DEBUG_LVL1
            printf("Calling the JAM worker processor.. \n");
        #endif
        jwork_processor(js);
    }

    return NULL;
}


void jwork_set_subscriptions(jamstate_t *js)
{
    // the /admin/announce/all subscription is already set..

    for (int i = 0; i < 3; i++)
    {
        if (js->cstate->mqttenabled[i])
        {
            mqtt_subscribe(js->cstate->mqttserv[i], "/level/func/reply/#");
            mqtt_subscribe(js->cstate->mqttserv[i], "/mach/func/request");
            // Subscribe to the "go" topic for sync purpose.
            mqtt_subscribe(js->cstate->mqttserv[i], "admin/request/Go");
        }
    }
}


/*
 * Set all the callback handlers
 *
 */
void jwork_set_callbacks(jamstate_t *js)
{
    callcontext_t *ctx = (callcontext_t *)calloc(1, sizeof(callcontext_t));
    ctx->context = js;

    if (js->cstate->mqttenabled[0] == true)
    {
        ctx->queue = js->deviceinq;
        ctx->indx = 0;
        MQTTClient_setCallbacks(js->cstate->mqttserv[0], ctx, jwork_connect_lost, jwork_msg_arrived, jwork_msg_delivered);
    }

    if (js->cstate->mqttenabled[1] == true)
    {
        ctx->queue = js->foginq;
        ctx->indx = 1;
        MQTTClient_setCallbacks(js->cstate->mqttserv[1], ctx, jwork_connect_lost, jwork_msg_arrived, jwork_msg_delivered);
    }

    if (js->cstate->mqttenabled[2] == true)
    {
        ctx->queue = js->cloudinq;
        ctx->indx = 2;
        MQTTClient_setCallbacks(js->cstate->mqttserv[2], ctx, jwork_connect_lost, jwork_msg_arrived, jwork_msg_delivered);
    }
}


void jwork_msg_delivered(void *ctx, MQTTClient_deliveryToken dt)
{
    // TODO: What to do here?
}

/*
 * The most important callback handler. This is executed in another anonymous thread
 * by the MQTT (Paho) Client library. We are not explicitly spawning the thread.
 *
 */

int jwork_msg_arrived(void *ctx, char *topicname, int topiclen, MQTTClient_message *msg)
{
//    printf("Time .1: %ld\n", activity_getuseconds());

    // the ctx pointer is actually pointing towards the queue - cast it
    simplequeue_t *queue = ((callcontext_t *)ctx)->queue;

    // We need handle the message based on the topic..
    if (strcmp(topicname, "/admin/announce/all") == 0)
    {
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
        //
    } else
    if (strncmp(topicname, "/level/func/reply", strlen("/level/func/reply") -1) == 0)
    {
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
        // Don't free the command structure.. the queue is still carrying it
    } else
    if (strncmp(topicname, "/mach/func/request", strlen("/mach/func/request") -1) == 0)
    {
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
        // Don't free the command structure.. the queue is still carrying it
    }
    else if (strncmp(topicname, "admin/request/Go", strlen("admin/request/Go") -1) == 0) {
        char *strSyncTime = msg->payload;
        command_t *cmd = command_new("GOGOGO", strSyncTime, "-", 0, "GLOBAL_INQUEUE", "__", "__", "");
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
    }

    MQTTClient_freeMessage(&msg);
    MQTTClient_free(topicname);
    return 1;
}

void jwork_connect_lost(void *ctx, char *cause)
{
    callcontext_t *call = (callcontext_t *)ctx;
    jamstate_t *js = call->context;
    int indx = call->indx;

    printf("Connection lost.. reconnecting\n");
    core_reconnect_i(js->cstate, indx);
}


// The FDs are put into a static array.
// Put the FDs in a particular order: OutQueue, DeviceQueue, FogQueue, CloudQueue,
// ActivityOutQueue[1..maxActQ]:
// Total slots (fixed): 1 + 3 + maxActQ
// No reassembling required.. but we are restricted to creating maxActQ activities.
// The Activity Queues are prespawned
//
void jwork_assemble_fds(jamstate_t *js)
{
    int i;

    js->numpollfds = 1 + 3 + MAX_ACT_THREADS;
    js->pollfds = (struct nn_pollfd *)calloc((js->numpollfds), sizeof(struct nn_pollfd));

    for (i = 0; i < js->numpollfds; i++)
        js->pollfds[i].events = NN_POLLIN;

    js->pollfds[0].fd = js->atable->globaloutq->pullsock;

    js->pollfds[1].fd = js->deviceinq->pullsock;
    js->pollfds[2].fd = js->foginq->pullsock;
    js->pollfds[3].fd = js->cloudinq->pullsock;

    for (i = 0; i < MAX_ACT_THREADS; i++)
        js->pollfds[4 + i].fd = js->atable->athreads[i]->outq->pullsock;

}


int jwork_wait_fds(jamstate_t *js)
{
    // TODO: we timeout every 1 second.. why?
    //
    return nn_poll(js->pollfds, js->numpollfds, 1000);
}

void jwork_processor(jamstate_t *js)
{
    // We know at least one descriptor has something for input processing
    // Need to scan all the decriptors

    // Use if constructs for the first 4 descriptors.. note we have a
    // fixed set of descriptors..
    //

    if (js->pollfds[0].revents & NN_POLLIN)
    {
        #ifdef DEBUG_LVL1
            printf("GLOBAL_OUT_SOCK has message \n");
        #endif
        jwork_process_globaloutq(js);
    }
    if (js->pollfds[1].revents & NN_POLLIN)
    {
        #ifdef DEBUG_LVL1
            printf("DEVICE_IN_SOCK has message\n");
        #endif
        jwork_process_device(js);
    }
    if (js->pollfds[2].revents & NN_POLLIN)
    {
        #ifdef DEBUG_LVL1
            printf("FOG_IN_SOCK has message\n");
        #endif
        jwork_process_fog(js);
    }
    if (js->pollfds[3].revents & NN_POLLIN)
    {
        #ifdef DEBUG_LVL1
            printf("CLOUD_IN_SOCK has message\n");
        #endif
        jwork_process_cloud(js);
    }

    for (int i = 0; i < MAX_ACT_THREADS; i++)
    {
        if (js->pollfds[i + 4].revents & NN_POLLIN)
            jwork_process_actoutq(js, i);
    }
}


// The global Output Q has all the commands the main thread wants to
// get executed: LOCAL and non LOCAL. If the "opt" field of the message
// is "LOCAL" we execute the command locally. Otherwise, it is sent to the
// remote node for
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
            printf("====================================== In global processing.. cmd: %s, opt: %s\n", rcmd->cmd, rcmd->opt);
        #endif
        // For local commands, we process them in this thread.. right here!
        // TODO: Figure out what type of commands should go in here
        if (strcmp(rcmd->opt, "LOCAL") == 0)
        {
            #ifdef DEBUG_LVL1
                printf("Processing the command in LOCAL mode.. \n");
            #endif

            // TODO: Do we have any LOCAL actions to do? With the new protocol design
            // this need may not exist anymore..
        }
        else
        {
            for (int i = 0; i < 3; i++)
                if (js->cstate->mqttenabled[i] == true)
                {
                    printf("Global outq %d\n", i);
                    mqtt_publish(js->cstate->mqttserv[i], "/level/func/request", rcmd);
                }
        }
        command_free(rcmd);
    }
}



//
// TODO: Do we have an inefficiency here? I am tracking an old comment that did not
// make much sense. The old comment follows.
//
// There is huge inefficiency here. We are encoding and decoding the data
// unnecessarily. We should just do pointer passing through the queue.
// Pointer could be referring to the command structure that was created by the
// activity in this case and the main thread in the above case..
//

void jwork_process_actoutq(jamstate_t *js, int indx)
{
    nvoid_t *nv = queue_deq(js->atable->athreads[indx]->outq);
    if (nv == NULL) return;

    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    #ifdef DEBUG_LVL1
        printf("\n\nACTOUTQ[%d]::  %s, opt: %s actarg: %s actid: %s\n\n\n", indx, rcmd->cmd, rcmd->opt, rcmd->actarg, rcmd->actid);
    #endif
    // Don't use nvoid_free() .. it is not deep enough

    if (rcmd != NULL)
    {
        // TODO: What else goes here..???
        // TODO: Revise this part...

        // relay the command to the remote servers..
        for (int i = 0; i < 3; i++)
            if (js->cstate->mqttenabled[i] == true)
            {
                printf("Actoutq .. i = %d\n", i);
                mqtt_publish(js->cstate->mqttserv[i], "/level/func/request", rcmd);
            }

        command_free(rcmd);
    }
}


// We have an incoming message from the J at device
// We need to process it here..
//
void jwork_process_device(jamstate_t *js)
{
    int quorum;

//    printf("Time .2: %ld\n", activity_getuseconds());

    // Get the message from the device to process
    //
    nvoid_t *nv = queue_deq(js->deviceinq);
    if (nv == NULL) return;

    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    #ifdef DEBUG_LVL1
        printf("\n\nIMPORTANT %s, opt: %s actarg: %s actid: %s\n\n\n", rcmd->cmd, rcmd->opt, rcmd->actarg, rcmd->actid);
    #endif
    // Don't use nvoid_free() .. it is not deep enough

    if (rcmd != NULL)
    {
        if (strcmp(rcmd->cmd, "PUT-CF-INFO") == 0)
        {
            core_makeconnection(js->cstate, rcmd);
            command_free(rcmd);
        }
        else
        if (strcmp(rcmd->cmd, "REXEC-SYN") == 0)
        {
            // TODO: Check the implementation of synchronization sub protocol..
            if (jwork_check_args(js, rcmd))
            {
                if (jcond_evaluate_cond(js, rcmd))
                {
                    // We have a valid request that should be executed by the node
                    if (jcond_synchronized(rcmd))
                    {
                        // A request that needs a quorum: a group for execution

                        quorum = jcond_getquorum(rcmd);
                        runtable_insert_synctask(js, rcmd, quorum);
                    }
                    else
                    {
                        printf("Adding unsynchronized task... \n");

                        // This is a standalone SYN request.. blocking call
                        // Because it is a blocking call.. we are going to go ahead and schedule it
                        int count = runtable_synctask_count(js->rtable);
                        if (count == 0)
                            // Sync tasks go into the high priority queue
                            p2queue_enq_high(js->atable->globalinq, rcmd, sizeof(command_t));
                        else
                            runtable_insert_synctask(js, rcmd, quorum);
                    }
                }
                else
                    jwork_send_nak(js, rcmd, "CONDITION FALSE");
            }
            else
                jwork_send_error(js, rcmd, "ARGUMENT ERROR");
        }
        else
        if (strcmp(rcmd->cmd, "REXEC-ASY") == 0)
        {
            if (jwork_check_args(js, rcmd))
            {
                if (jcond_evaluate_cond(js, rcmd))
                {
                    p2queue_enq_low(js->atable->globalinq, rcmd, sizeof(command_t));
                }
                else
                    jwork_send_nak(js->cstate->mqttserv[0], rcmd, "CONDITION FALSE");
            }
            else
                jwork_send_error(js, rcmd, "ARGUMENT ERROR");
        }
        else
        if (strcmp(rcmd->cmd, "REXEC-ASY-CBK") == 0)
        {
            if (runtable_find(js->rtable, rcmd->actarg) != NULL)
            {
                if (jcond_evaluate_cond(js, rcmd))
                {
                    p2queue_enq_low(js->atable->globalinq, rcmd, sizeof(command_t));
                }
                else
                    jwork_send_nak(js->cstate->mqttserv[0], rcmd, "CONDITION FALSE");
            }
        }
        else
        if ((strcmp(rcmd->cmd, "REXEC-ACK") == 0) ||
            (strcmp(rcmd->cmd, "REXEC-NAK") == 0) ||
            (strcmp(rcmd->cmd, "REXEC-RES") == 0))
        {
            // resolve the activity id to index
            int aindx = activity_id2indx(js->atable, rcmd->actid);
            if (aindx >= 0)
            {
                activity_thread_t *athr = js->atable->athreads[aindx];
                // send the rcmd to that queue.. this is a pushqueue
                pqueue_enq(athr->inq, rcmd, sizeof(command_t));
            }
        }
        else
        if (strcmp(rcmd->cmd, "GOGOGO") == 0) {
			// Received the "go" from J nodes, we put the go command into the high queue
            p2queue_enq_high(js->atable->globalinq, rcmd, sizeof(command_t));
        }
        else
        {
            printf("Command %s freed...............\n", rcmd->cmd);
            command_free(rcmd);
        }
    }
}


void jwork_send_error(jamstate_t *js, command_t *cmd, char *estr)
{
    MQTTClient mcl = js->cstate->mqttserv[0];
    char *deviceid = js->cstate->device_id;

    // Create a new command to send as error..
    command_t *scmd = command_new("REXEC-ERR", "ERR", "-", 0, cmd->actname, cmd->actid, deviceid, "s", estr);

    // send the command over
    mqtt_publish(mcl, "/mach/func/reply", scmd);

    // deallocate the command string..
    command_free(cmd);
}


void jwork_send_nak(jamstate_t *js, command_t *cmd, char *estr)
{
    MQTTClient mcl = js->cstate->mqttserv[0];
    char *deviceid = js->cstate->device_id;

    // Create a new command to send as error..
    command_t *scmd = command_new("REXEC-NAK", "NAK", "-", 0, cmd->actname, cmd->actid, deviceid, "s", estr);

    // send the command over
    mqtt_publish(mcl, "/mach/func/reply", scmd);

    // deallocate the command string..
    command_free(cmd);
}


void jwork_send_results(jamstate_t *js, char *actname, char *actid, arg_t *args)
{
    MQTTClient mcl = js->cstate->mqttserv[0];
    char *deviceid = js->cstate->device_id;

    // Create a new command to send as error..
    command_t *scmd = command_new_using_arg("REXEC-RES", "SYN", "-", 0, actname, actid, deviceid, args, 1);

    // send the command over
    mqtt_publish(mcl, "/mach/func/reply", scmd);

}


bool jwork_check_args(jamstate_t *js, command_t *cmd)
{
    activity_callback_reg_t *areg = activity_findcallback(js->atable, cmd->actname);
    if (areg != NULL)
    {
        return jrun_check_signature(areg, cmd);
    }
    else
        return false;
}


// We have an incoming message from the J at fog
// We need to process it here..
//
void jwork_process_fog(jamstate_t *js)
{
    // Get the message from the fog to process
    //
    nvoid_t *nv = queue_deq(js->foginq);
    if (nv == NULL) return;

    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    #ifdef DEBUG_LVL1
        printf("\n\nIMPORTANT %s, opt: %s actarg: %s actid: %s\n\n\n", rcmd->cmd, rcmd->opt, rcmd->actarg, rcmd->actid);
    #endif
    // Don't use nvoid_free() .. it is not deep enough

    if (rcmd != NULL)
    {
        // We are getting replies from the fog level for requests that
        // were sent from the C. There is no unsolicited replies.

        // TODO: Can we detect unsolicited replies and discard them?
        if ((strcmp(rcmd->cmd, "REXEC-ACK") == 0) ||
            (strcmp(rcmd->cmd, "REXEC-NAK") == 0))
        {
            // resolve the activity id to index
            int aindx = activity_id2indx(js->atable, rcmd->actid);
            if (aindx >= 0)
            {
                activity_thread_t *athr = js->atable->athreads[aindx];
                // send the rcmd to that queue.. this is a pushqueue
                pqueue_enq(athr->inq, rcmd, sizeof(command_t));
            }
        }
        else
        {
            command_free(rcmd);
        }
    }
}


// We have an incoming message from the J at cloud
// We need to process it here..
//
void jwork_process_cloud(jamstate_t *js)
{
    // Get the message from the cloud to process
    //
    nvoid_t *nv = queue_deq(js->cloudinq);
    if (nv == NULL) return;

    command_t *rcmd = (command_t *)nv->data;
    free(nv);
    #ifdef DEBUG_LVL1
        printf("\n\nIMPORTANT %s, opt: %s actarg: %s actid: %s\n\n\n", rcmd->cmd, rcmd->opt, rcmd->actarg, rcmd->actid);
    #endif
    // Don't use nvoid_free() .. it is not deep enough

    if (rcmd != NULL)
    {
        // We are getting replies from the fog level for requests that
        // were sent from the C. There is no unsolicited replies.

        // TODO: Can we detect unsolicited replies and discard them?
        if ((strcmp(rcmd->cmd, "REXEC-ACK") == 0) ||
            (strcmp(rcmd->cmd, "REXEC-NAK") == 0))
        {
            // resolve the activity id to index
            int aindx = activity_id2indx(js->atable, rcmd->actid);
            if (aindx >= 0)
            {
                activity_thread_t *athr = js->atable->athreads[aindx];
                // send the rcmd to that queue.. this is a pushqueue
                pqueue_enq(athr->inq, rcmd, sizeof(command_t));
            }
        }
        else
        {
            command_free(rcmd);
        }
        // Send the command (rcmd) to the activity given the above pointer is non NULL
    }
}


void tcallback(void *arg)
{
    activity_thread_t *athr = (activity_thread_t *)arg;

    #ifdef DEBUG_LVL1
        printf("Callback.. Thread ID %d.. Queue %d, actid %s\n", athr->threadid, athr->inq->queue->pushsock, athr->actid);
    #endif
    // stick the "TIMEOUT" message into the queue for the activity
    command_t *tmsg = command_new("TIMEOUT", "-", "-", 0, "ACTIVITY", athr->actid, "__", "");
    pqueue_enq(athr->inq, tmsg, sizeof(command_t));
    // do a signal on the thread semaphore for the activity
    #ifdef DEBUG_LVL1
        printf("Callback Occuring... \n");
    #endif
}


void stcallback(void *arg)
{

    printf("Triggering the sync timer callback...\n");
    jamstate_t *js = (jamstate_t *)arg;
    // stick the "TIMEOUT" message into the queue for the activity
    command_t *tmsg = command_new("SYNC_TIMEOUT", "-", "-", 0, "GLOBAL_INQUEUE", "__", "__", "");
    p2queue_enq_high(js->atable->globalinq, tmsg, sizeof(command_t));
}


void jam_set_timer(jamstate_t *js, char *actid, int tval)
{
 //   printf("JAM-set-timer for actid .. %s\n", actid);

    activity_thread_t *athr = activity_getbyid(js->atable, actid);
    if (athr != NULL)
        timer_add_event(js->maintimer, tval, 0, actid, tcallback, athr);
    else
        printf("ERROR! Unable to find the activity to trigger at timer event.\n");
}


void jam_clear_timer(jamstate_t *js, char *actid)
{
 //   printf("JAM-clear-timer %s\n", actid);

    timer_del_event(js->maintimer, actid);
}


// Not finalized at all, just testing
void jam_set_sync_timer(jamstate_t *js, int tval)
{
    if (js->synctimer != NULL)
    {
        double now = getcurtime();

        printf("current time: %f\n", now);
        double syncStartTime = (double) ((int) (now+1));
        printf("start time: %f\n", syncStartTime);
        printf("Setting sync timer %d\n", tval);
        while(getcurtime() < syncStartTime) {}
        printf("starting.. : %f\n", getcurtime());
        timer_add_event(js->synctimer, tval, 1, "synctimer-------", stcallback, js);
    }
}
