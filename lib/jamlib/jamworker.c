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
#include "jamdata.h"
#include "nvoid.h"
#include "mqtt.h"
#include "activity.h"
#include "simplelist.h"

extern list_elem_t *cache;
extern int cachesize;


void on_dev_connect(void* context, MQTTAsync_successData* response)
{
    command_t *scmd;

    corestate_t *cs = (corestate_t *)context;

    // Set the subscriptions
    core_set_subscription(cs, 0);

    scmd = command_new("REGISTER", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
    mqtt_publish(cs->mqttserv[0], "/admin/request/all", scmd);

    // NOTE: For now, I am putting the mqttenabled flag setting here.
    // This is for the device.
    // A better alternative is to get the REGISTER-ACK and set the flag
    cs->mqttenabled[0] = true;
    core_check_pending(cs);
}

void on_fog_connect(void* context, MQTTAsync_successData* response)
{
    command_t *scmd;
    corestate_t *cs = (corestate_t *)context;

    // Set the subscriptions
    core_set_subscription(cs, 0);

    scmd = command_new("REGISTER", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
    mqtt_publish(cs->mqttserv[1], "/admin/request/all", scmd);

    // NOTE: For now, I am putting the mqttenabled flag setting here.
    // This is for the device.
    // A better alternative is to get the REGISTER-ACK and set the flag
    cs->mqttenabled[1] = true;
    core_check_pending(cs);
}


void on_cloud_connect(void* context, MQTTAsync_successData* response)
{
    command_t *scmd;
    corestate_t *cs = (corestate_t *)context;

    // Set the subscriptions
    core_set_subscription(cs, 0);

    scmd = command_new("REGISTER", "DEVICE", "-", 0, "-", "-", cs->device_id, "");
    mqtt_publish(cs->mqttserv[2], "/admin/request/all", scmd);

    // NOTE: For now, I am putting the mqttenabled flag setting here.
    // This is for the device.
    // A better alternative is to get the REGISTER-ACK and set the flag
    cs->mqttenabled[2] = true;
    core_check_pending(cs);
}



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

    char localhost[64];
    sprintf(localhost, "tcp://localhost:%d", js->cstate->port);
    core_createserver(js->cstate, 0, localhost);
    comboptr_t *ctx = create_combo3i_ptr(js, js->deviceinq, NULL, 0);
    // Set the callback handlers .. this is necessary befor the actual connection
    core_setcallbacks(js->cstate, ctx, jwork_connect_lost, jwork_msg_arrived, NULL);

    // Now do the connection to the local server
    core_connect(js->cstate, 0, on_dev_connect);

    // assemble the poller.. insert the FDs that should go into the poller
    jwork_assemble_fds(js);

    // NOTE: signalling on bgsem happens in a callback now
    // We need to signal the main thread to proceed only after the local J
    // responds to the registration

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


/*
 * The most important callback handler. This is executed in another anonymous thread
 * by the MQTT (Paho) Client library. We are not explicitly spawning the thread.
 *
 */

int jwork_msg_arrived(void *ctx, char *topicname, int topiclen, MQTTAsync_message *msg)
{
    // the ctx pointer is used to recover original context.
    comboptr_t *cptr = (comboptr_t *)ctx;
    simplequeue_t *queue = (simplequeue_t *)(cptr->arg2);

    // We need handle the message based on the topic..
    if (strcmp(topicname, "/admin/announce/all") == 0)
    {
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);

        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
    }
    else
    if (strncmp(topicname, "/level/func/reply", strlen("/level/func/reply") -1) == 0)
    {
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
        // Don't free the command structure.. the queue is still carrying it
    }
    else
    if (strncmp(topicname, "/mach/func/request", strlen("/mach/func/request") -1) == 0)
    {
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        command_t *cmd = command_from_data(NULL, nv);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
        // Don't free the command structure.. the queue is still carrying it
    }
    else
    if (strncmp(topicname, "admin/request/Go", strlen("admin/request/Go") -1) == 0) {
        char *strSyncTime = msg->payload;
        command_t *cmd = command_new("GOGOGO", strSyncTime, "-", 0, "GLOBAL_INQUEUE", "__", "__", "");
        nvoid_t *nv = nvoid_new(msg->payload, msg->payloadlen);
        nvoid_free(nv);
        queue_enq(queue, cmd, sizeof(command_t));
    }

    MQTTAsync_freeMessage(&msg);
    MQTTAsync_free(topicname);
    return 1;
}


void jwork_connect_lost(void *ctx, char *cause)
{
    comboptr_t *call = (comboptr_t *)ctx;
    jamstate_t *js = (jamstate_t *)(call->arg1);
    int indx = call->iarg;

    if (indx == 0)
    {
        printf("ERROR! MQTT Broker at %s stopped. Exiting.\n", js->cstate->mqtthost[0]);
        exit(1);
    }
    else
    {
        printf("Connection lost at %d.. reconnecting\n", indx);
    //    core_reconnect_i(js->cstate, indx);
    }
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
    int i;

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
            command_free(rcmd);
        }
        else
        {
            // increment the reference count..
            for (i = 1; i < 3; i++)
                if (js->cstate->mqttenabled[i] == true)
                    command_hold(rcmd);

            for (i = 0; i < 3; i++)
                if (js->cstate->mqttenabled[i] == true)
                {
                    printf("Global outq %d\n", i);
                    mqtt_publish(js->cstate->mqttserv[i], "/level/func/request", rcmd);
                }
        }
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
    int i;
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

        // Increment the hold on rcmd.. so that memory deallocation happens after all use
        for (i = 1; i < 3; i++)
            if (js->cstate->mqttenabled[i] == true)
                command_hold(rcmd);

        // relay the command to the remote servers..
        for (int i = 0; i < 3; i++)
            if (js->cstate->mqttenabled[i] == true)
            {
                printf("Actoutq .. i = %d, MQTTHost %s, MQTTServ %p\n", i, js->cstate->mqtthost[i], js->cstate->mqttserv[i]);
                mqtt_publish(js->cstate->mqttserv[i], "/level/func/request", rcmd);
            }
    }
}


// We have an incoming message from the J at device
// We need to process it here..
//
void jwork_process_device(jamstate_t *js)
{
    int quorum = 0;

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
        if (strcmp(rcmd->cmd, "KILL") == 0)
        {
            printf("ERROR! Kill message received from the J node.\n");
            printf("Exiting.\n");
            exit(1);
        }
        else
        if (strcmp(rcmd->cmd, "REGISTER-ACK") == 0)
        {
            command_t *scmd = command_new("GET-CF-INFO", "-", "-", 0, "-", "-", js->cstate->device_id, "");
            mqtt_publish(js->cstate->mqttserv[0], "/admin/request/all", scmd);
            // We are done with
            thread_signal(js->bgsem);
        }
        else
        if (strcmp(rcmd->cmd, "PING") == 0)
        {
            // If registration is still not complete.. send another registration
            // Although this could be a very rare event.. (missing REGISTER message)


            // If CF information is still pending.. send a REFRESH to get the
            // latest information... the callback is already there..

            if (js->cstate->cf_pending)
            {
                command_t *scmd = command_new("REF-CF-INFO", "-", "-", 0, "-", "-", js->cstate->device_id, "");
                mqtt_publish(js->cstate->mqttserv[0], "/admin/request/all", scmd);
            }
        }
        else
        if (strcmp(rcmd->cmd, "PUT-CF-INFO") == 0)
        {
            if ((strcmp(rcmd->actarg, "fog") == 0) && (strcmp(rcmd->opt, "ADD") == 0))
            {
                core_createserver(js->cstate, 1, rcmd->args[0].val.sval);
                comboptr_t *ctx = create_combo3i_ptr(js, js->foginq, NULL, 1);
                core_setcallbacks(js->cstate, ctx, jwork_connect_lost, jwork_msg_arrived, NULL);
                core_connect(js->cstate, 1, on_fog_connect);
            }
            else
            if ((strcmp(rcmd->actarg, "cloud") == 0) && (strcmp(rcmd->opt, "ADD") == 0))
            {
                core_createserver(js->cstate, 2, rcmd->args[0].val.sval);
                comboptr_t *ctx = create_combo3i_ptr(js, js->cloudinq, NULL, 2);
                core_setcallbacks(js->cstate, ctx, jwork_connect_lost, jwork_msg_arrived, NULL);
                core_connect(js->cstate, 2, on_cloud_connect);
            }
            command_free(rcmd);
            core_check_pending(js->cstate);
        }
        else
        if ((strcmp(rcmd->cmd, "REXEC-ASY") == 0) ||
            (strcmp(rcmd->cmd, "REXEC-SYN") == 0))
        {
            // Check for duplicate
            if (find_list_item(cache, rcmd->actid))
            {
                command_free(rcmd);
                return;
            }
            else
            {
                put_list_tail(cache, strdup(rcmd->actid), strlen(rcmd->actid));
                if (list_length(cache) > cachesize)
                    del_list_tail(cache);
            }

            if (jwork_evaluate_cond(rcmd->cond))
                p2queue_enq_low(js->atable->globalinq, rcmd, sizeof(command_t));
            else
                jwork_send_nak(js, rcmd, "CONDITION FALSE");
        }
        else
        if (strcmp(rcmd->cmd, "REXEC-ASY-CBK") == 0)
        {
            if (runtable_find(js->rtable, rcmd->actarg) != NULL)
            {
                if (jwork_evaluate_cond(rcmd->cond))
                    p2queue_enq_low(js->atable->globalinq, rcmd, sizeof(command_t));
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
    MQTTAsync mcl = js->cstate->mqttserv[0];
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
    MQTTAsync mcl = js->cstate->mqttserv[0];
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
    MQTTAsync mcl = js->cstate->mqttserv[0];
    char *deviceid = js->cstate->device_id;

    // Create a new command to send as error..
    command_t *scmd = command_new_using_arg("REXEC-RES", "SYN", "-", 0, actname, actid, deviceid, args, 1);

    // send the command over
    mqtt_publish(mcl, "/mach/func/reply", scmd);

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

bool jwork_evaluate_cond(char *cnd)
{
    if (strlen(cnd) == 0)
        return true;
    return jcond_eval_bool(cnd);
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
