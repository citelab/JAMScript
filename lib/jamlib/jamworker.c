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
            printf("Calling the JAM worker processor.. %d\n", js->rtable->numruns);
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
        }
    }
}


/* 
 * Set all the callback handlers
 * 
 */
void jwork_set_callbacks(jamstate_t *js)
{
    if (js->cstate->mqttenabled[0] == true)
        MQTTClient_setCallbacks(js->cstate->mqttserv[0], js->deviceinq, jwork_connect_lost, jwork_msg_arrived, jwork_msg_delivered);
    
    if (js->cstate->mqttenabled[1] == true)
        MQTTClient_setCallbacks(js->cstate->mqttserv[1], js->foginq, jwork_connect_lost, jwork_msg_arrived, jwork_msg_delivered);

    if (js->cstate->mqttenabled[2] == true)
        MQTTClient_setCallbacks(js->cstate->mqttserv[2], js->cloudinq, jwork_connect_lost, jwork_msg_arrived, jwork_msg_delivered);
}


void jwork_msg_delivered(void *ctx, MQTTClient_deliveryToken dt)
{
    printf("Message with token value %d delivery confirmed\n", dt);
}

/*
 * The most important callback handler. This is executed in another anonymous thread
 * by the MQTT (Paho) Client library. We are not explicitly spawning the thread. 
 *
 */

int jwork_msg_arrived(void *ctx, char *topicname, int topiclen, MQTTClient_message *msg)
{
    int i;

    // the ctx pointer is actually pointing towards the queue - cast it
    simplequeue_t *queue = (simplequeue_t *)ctx;

    // We need handle the message based on the topic.. 
    if (strcmp(topicname, "/admin/announce/all") == 0) 
    {
        // TODO: Ignore these messages??
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

    MQTTClient_freeMessage(&msg);
    MQTTClient_free(topicname);
    return 1;
}

void jwork_connect_lost(void *context, char *cause)
{
    printf("\nConnection lost\n");
    printf("     cause: %s\n", cause);
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
                    mqtt_publish(js->cstate->mqttserv[i], "/leve/func/request", rcmd);
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
                printf("Published to /level  \n");
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
        // TODO: Implement a synchronization sub protocol.. 
        //
        if (strcmp(rcmd->cmd, "REXEC-SYN") == 0) 
        {
            // TODO: Need to synchronize
            if (jwork_synchronize(js)) 
            {
                if (jwork_check_args(js, rcmd))
                {
                    if (jwork_check_condition(js, rcmd))
                        pqueue_enq(js->atable->globalinq, rcmd, sizeof(command_t));
                    else 
                        jwork_send_nak(js->cstate->mqttserv[0], rcmd, "CONDITION FALSE");
                }
                else
                    jwork_send_error(js->cstate->mqttserv[0], rcmd, "ARGUMENT ERROR");
            }
            else
                jwork_send_nak(js->cstate->mqttserv[0], rcmd, "SYNC FAILED");
        }
        else 
        if (strcmp(rcmd->cmd, "REXEC-ASY") == 0)
        {
            if (jwork_check_args(js, rcmd))
            {
                if (jwork_check_condition(js, rcmd))
                {
                    pqueue_enq(js->atable->globalinq, rcmd, sizeof(command_t));
                }
                else 
                    jwork_send_nak(js->cstate->mqttserv[0], rcmd, "CONDITION FALSE");
            }
            else
                jwork_send_error(js->cstate->mqttserv[0], rcmd, "ARGUMENT ERROR");
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
        {
            command_free(rcmd);
        }
    }
}

// TODO: Implement this properly.
void jwork_send_error(MQTTClient mcl, command_t *cmd, char *estr)
{
    
}

// TODO: Implement this properly.
void jwork_send_nak(MQTTClient mcl, command_t *cmd, char *estr)
{
    
}


// TODO: Implement this properly.
bool jwork_check_condition(jamstate_t *js, command_t *cmd)
{
    return true;
}

// TODO: Implement this properly.
bool jwork_check_args(jamstate_t *js, command_t *cmd)
{
    return true;
}

// TODO: Implement this properly.
bool jwork_synchronize(jamstate_t *js)
{

    return true;

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
        {
            command_free(rcmd);
        }
        // Send the command (rcmd) to the activity given the above pointer is non NULL
    }
}



// This is evaluating a JavaScript expression for the nodal predicate
// TODO: Fix this.. this incomplete.
//numruns
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
// At this point, we are limited to MAX_RUN_ENTRIESnumruns
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
    //ren->result = NULL;
    ren->actid = NULL;
    ren->status = NEW;

    return false;
}


command_t *jwork_runid_status(jamstate_t *js, char *runid)
{
    command_t *scmd;
    int i;

    char *deviceid = js->cstate->device_id;

    #ifdef DEBUG_LVL1
        printf("Devide id %s\n", deviceid);
    #endif
    // search for the runtime entry..
    for (i = 0; i < js->rtable->numruns; i++)
    {
        if (strcmp(js->rtable->entries[i]->actid, runid) == 0)
            break;
    }

    // if not found, then return NULL
    if (i >= js->rtable->numruns)
        return NULL;



    runtableentry_t *ren = js->rtable->entries[i];

    // create the command to reply with the status update..
    // send [[ REPORT-REP FIN actname deviceid runid res (arg0)] (res is a single object) or
    //
    if (ren->status == COMPLETED)
    {
        if (ren->result_list[0] == NULL)
        {
            scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "");
            return scmd;
        }

        switch (ren->result_list[0]->type)
        {
            case STRING_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "s", ren->result_list[0]->val.sval);
            break;

            case INT_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "i", ren->result_list[0]->val.ival);
            break;

            case DOUBLE_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "d", ren->result_list[0]->val.dval);
            break;

            case NVOID_TYPE:
                scmd = command_new("REPORT-REP", "FIN", ren->actname, deviceid, runid, "b", ren->result_list[0]->val.nval);
            break;
            case NULL_TYPE:
            break;
        }
        return scmd;
    }

    return NULL;
}


// This emthod is going to be used to complete with success or flag error
// for the runid.. this is done just before the activity deletion..
//
void jwork_runid_complete(jamstate_t *js, runtable_t *rtab, char *actid, arg_t *arg)
{
    int i;
    // search for the runtime entry..
    for (i = 0; i < rtab->numruns; i++)
    {   
        if (strcmp(rtab->entries[i]->actid, actid) == 0)
            break;
    }

    // if not found, then return
    if (i >= rtab->numruns)
        return;

    runtableentry_t *ren = rtab->entries[i];

    ren->status = COMPLETED;
    ren->result_list[0] = arg;
    
    command_t *result = jwork_runid_status(js, actid);
    if (result != NULL){
      //  for(int i = 0; i < js->cstate->num_fog_servers + js->cstate->num_cloud_servers; i++)
      //      socket_send(js->cstate->reqsock[i], result);
        command_free(result);
    }
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


runtableentry_t *find_table_entry(runtable_t *table, command_t *cmd)
{
    for(int i = 0; i < MAX_RUN_ENTRIES; i++)
    {
        if(table->entries[i] != NULL)
        {
            if(strcmp(cmd->actid, table->entries[i]->actid) == 0)
                return table->entries[i];
        }
    }
    return NULL;
}


command_t *prepare_sync_return_result(runtableentry_t *act_entry, command_t *rcmd)
{
    //Now we need to compare the values ... 
    //Here we assume that we can only return a single value and hence rcmd->nargs = 1
    if(rcmd->nargs != 1)
    {
        printf("Invalid return arguments ... \nError ...\n");
        return return_err_arg(rcmd, "RET-FAILURE");
    }
    for(int i = 1; i < 1; i++)
    { 
        // TODO check ; num_rcv_something.. was here.
        if (act_entry->result_list[0]->type != act_entry->result_list[i]->type)
        {
            printf("Inconsistent Results ... \n");
            return return_err_arg(rcmd, "RET-FAILURE");
        }
        switch(act_entry->result_list[0]->type)
        {
            case INT_TYPE:
                if (act_entry->result_list[0]->val.ival != act_entry->result_list[i]->val.ival)
                {
                    printf("Inconsistent Results ... int ... \n");
                    return return_err_arg(rcmd, "RET-FAILURE");
                }
                break;
            case STRING_TYPE:
                if (strcmp(act_entry->result_list[0]->val.sval, act_entry->result_list[i]->val.sval) != 0)
                {
                    printf("Inconsistent Results ... string ... %s %s\n", act_entry->result_list[0]->val.sval, act_entry->result_list[i]->val.sval);
                    return return_err_arg(rcmd, "RET-FAILURE");
                }
                break;
            case DOUBLE_TYPE:
                if (act_entry->result_list[0]->val.dval != act_entry->result_list[i]->val.dval)
                {
                    printf("Inconsistent Results ... double ... \n");
                    return return_err_arg(rcmd, "RET-FAILURE");
                }
                break;
            case NVOID_TYPE: 
                printf("Not yet implemented ...\n");
                break;
            case NULL_TYPE:
                break;
        }
    }
    return rcmd;
}

command_t *return_err_arg(command_t *rcmd, char *err_msg)
{

    for (int i = 0; i < rcmd->nargs; i++)
    {
        if (rcmd->args[i].type == STRING_TYPE)
            free(rcmd->args[i].val.sval);
        else if (rcmd->args[i].type == NVOID_TYPE)
            nvoid_free(rcmd->args[i].val.nval);
    }
    
    free(rcmd->args);
    rcmd->args = calloc(1, sizeof(arg_t));
    rcmd->args[0].val.sval = strdup(err_msg);
    rcmd->args[0].type = STRING_TYPE;
    rcmd->nargs = 1;
    return rcmd;
}


bool insert_runtable_entry(jamstate_t * js, command_t *rcmd)
{
    runtableentry_t *act_entry = calloc(1, sizeof(runtableentry_t));

    act_entry->actname = strdup(rcmd->actname);
    act_entry->actid = strdup(rcmd->actid);
    act_entry->cmd = rcmd;
    act_entry->num_replies = js->cstate->mqttenabled[0] + js->cstate->mqttenabled[1] + js->cstate->mqttenabled[2];
    
    //To insert the entry into the table
    #ifdef DEBUG_LVL1
        printf("Added Value: %p %s\n", act_entry, act_entry->actid);
    #endif
    
    for(int i = 0; i < MAX_RUN_ENTRIES; i++)
    {
        if(js->rtable->entries[i] == NULL)
        {
            js->rtable->entries[i] = act_entry;
            js->rtable->numruns++;
            act_entry->index = i;
            return true;
        }
    }

    return false;
}


void free_rtable_entry(runtable_t *table, runtableentry_t *entry)
{
    if (entry == NULL)
        return;

    #ifdef DEBUG_LVL1
        printf("Removing Value: %p %s\n", entry, entry->actid);
    #endif

    for (int i = 0; i < MAX_RUN_ENTRIES; i++)
    {
        if(table->entries[i] == entry)
        {
            table->entries[i] = NULL;
            table->numruns--;
            break;
        }
    }

    if (entry->runid != NULL)
        free(entry->runid);
    if (entry->actid != NULL)
        free(entry->actid);
    if (entry->actname != NULL)
        free(entry->actname);
    free(entry);
}


void tcallback(void *arg)
{
    activity_thread_t *athr = (activity_thread_t *)arg;

    #ifdef DEBUG_LVL1
        printf("Callback.... \n");
    #endif
    // stick the "TIMEOUT" message into the queue for the activity
    command_t *tmsg = command_new("TIMEOUT", "__", "ACTIVITY", athr->actid, "__", "");
    pqueue_enq(athr->inq, tmsg, sizeof(command_t));
    // do a signal on the thread semaphore for the activity
    #ifdef DEBUG_LVL1
        printf("Callback Occuring... \n");
    #endif
}


void jam_set_timer(jamstate_t *js, char *actid, int tval)
{
    activity_thread_t *athr = activity_getbyid(js->atable, actid);
    if (athr != NULL)
        timer_add_event(js->maintimer, tval, 0, actid, tcallback, athr);
}


void jam_clear_timer(jamstate_t *js, char *actid)
{
    timer_del_event(js->maintimer, actid);
}
