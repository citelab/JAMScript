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

#include "jamlib.h"
#include "core.h"

// Initialize the JAM library.. nothing much done here.
// We just initialize the Core ..
//
jamstate_t *jam_init()
{
    jamstate_t *js = (jamstate_t *)calloc(1, sizeof(jamstate_t));

    // TODO: Remove the hardcoded timeout values
    // 200 milliseconds timeout now set
    js->cstate = core_init(200);

    // Callback initialization
    js->callbacks = callbacks_new();

    // Queue initialization
    // maininq is used by the main thread for input purposes
    // mainoutq is used by the main thread for output purposes
    js->maininq = queue_new(true);
    js->mainoutq = queue_new(true);

    bzero(&(js->mainthreadsem), sizeof(Rendez));

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    return js;
}


bool jam_create_bgthread(jamstate_t *js)
{
    int rval = pthread_create(&(js->bgthread), NULL, jamworker_bgthread, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jamworker thread");
        return false;
    }
    return true;
}



// Check whether there are any more pending JAM activities.
// If none are pending, we can exit the program right away.
// If some activities are pending, we defer the execution of the jam_exit(1).
//
int jam_exit(jamstate_t *js)
{
    if (jam_pending_acts(js) > 0) {
        //

    }

}

// Send a message to the J-core informing it that C-core (device) is ready.
// The J-core is supposed to engage with the C-core after it receives this message.
// If the C-core is not receiving any interactions.. it will repeat sending this message
// Assuming this message is lost..
//
// This function is invoked by the JAM program...
//
bool jam_core_ready(jamstate_t *js)
{

}

// Start the background processing loop.
//
//
void jam_event_loop(jamstate_t *js)
{
    jamstate_t *js = (jamstate_t *)arg;
    event_t *e = NULL;

    while ((e = get_event(js))) {
        if (e != NULL)
            callbacks_call(js->callbacks, app, e);
        else
            taskexit(0);

        taskyield();
    }
}


// TODO: This needs to revamped. Timeouts come here too.
// The RPC processing is complicated.. it could have changes here too.
// TODO: Add many different types of events here with the new design!
//
//
event_t *get_event(jamstate_t *js)
{
    int len;
    unsigned char *buf = (unsigned char *)queue_deq(js->queue, &len);
    command_t *cmd = command_from_data(NULL, buf, len);

    if (cmd == NULL)
        return NULL;

    if (cmd->cmd == NULL)
        return NULL;

    // TODO: Something should be done here...

    return NULL;
}


void jam_reg_callback(jamstate_t *js, char *aname, eventtype_t etype, event_callback_f cb, void *data)
{
    callbacks_add(js->callbacks, aname, etype, cb, data);
}



jactivity_t *jam_rexec(jamstate_t *js, char *aname, ...)
{
    // find the activity..
    jactivity_t *jact = activity_getbyname(js->atable, aname);

    // get the mask
    char *fmask = activity_get_mask(jact);

    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *elem;

    va_start(args, aname);

    while(*fmask)
    {
        switch(*fmask++)
        {
            case 's':
                elem = cbor_build_string(va_arg(args, char *));
                break;
            case 'i':
                val = va_arg(args, int);
                elem = cbor_build_uint32(abs(val));
                if (val < 0)
                    cbor_mark_negint(elem);
                break;
            case 'd':
            case 'f':
                elem = cbor_build_float8(va_arg(args, double));
                break;
            default:
                break;
        }
        if (elem)
            assert(cbor_array_push(arr, elem) == true);
    }
    va_end(args);

    // Get the type
    int type = activity_get_type(jact);

    if (type == SYNCHRONOUS_ACTIVITY)
    {    // create the command structure..
        command_t *cmd = command_new_using_cbor("REXEC", "SYNC", aname, arr);
        return jam_rexec_sync(js, cmd);
    }
    else
    {
        command_t *cmd = command_new_using_cbor("REXEC", "ASYNC", aname, arr);
        return jam_rexec_async(js, jact, cmd);
    }

}

jactivity_t *jam_rexec_sync(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    int i = 0;
    command_t *rcmd;
    // Send command to the fog using the REQUEST socket
    while (i < js->cstate->retries)
    {
        socket_send(js->reqsock, cmd);
        rcmd = socket_recv_command(js->reqsock, 50);       // TODO: Make this aynchronous.. right now the thread is blocked
        if (rcmd != NULL)
            break;

        i++;
    }

    // IMPORTANT: Fix the above problem. This could hold up the thread
    // Although, there might be a justification for doing this part synchronously..
    // This part should take little time.

    // Return NULL if we failed to connect..
    if (i == js->csstate->retries)
    {
        command_free(rcmd);
        return NULL;
    }

    for (i = 0; i < js->maxleases; i++)
    {
        int timerval = jam_get_timer_from_reply(rmcd);
        command_free(rcmd);
        jam_set_timer(js, jact->name, timerval);
        tasksleep(&(jact->sem));
        jam_get_event_for_activity(js, rcmd);
        if (strcmp(rcmd->cmd, "TIMEOUT") == 0) {
            command_t *lcmd = command_new("STATUS", "LEASE", jact->name, "");
            socket_send(js->reqsock, lcmd);
            command_free(lcmd);
            rcmd = socket_recv_command(js->reqsock, 100);       // TODO: What value here?
            continue;
        }
        else
        if (strcmp(rcmd->cmd, "REXEC") == 0 &&
            strcmp(rcmd->opt, "COMPLETE") == 0) {

            break;
        }
        else
        if (strcmp(rcmd->cmd, "REXEC") == 0 &&
            strcmp(rcmd->opt, "ERROR") == 0) {

            break;
        }
        i++;
    }

    // activity timed out..
    // It is taking way too long to run at the J-core

    // Send a kill commmand...


}


jactivity_t *jam_rexec_async(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    // Find the fog J-core

    // Send command to the fog

    // If we are unable to get the ack.. fail execution

    // get lease period from the ack..
    // setup the wakeup timer based on lease time

    // for 1 to maxleases try the following:

        // wait until the lease over or results obtained
        // TODO: Tasksleep should be used here... it is woken up by
        // Timer event or something comes from the destination

        // if results not obtained, check with remote for exec status
        // if new lease, set timer
        // if results obtained, return results else return failure
}




int jam_raise_event(jamstate_t *js, char *tag, EventType etype, char *cback, char *fmt, ...)
{

}


/*
 * Send the given event to the remote side.
 * tag - arbitrary value (activity name or something else)
 * cback - callback
 * format - s (string), i (integer) f,d for float/double - no % (e.g., "si")
 *
 */
int raise_event(Application *app, char *tag, EventType etype, char *cback, char *fmt, ...)
{
    va_list args;
    char fbuffer[BUFSIZE];
    char *bufptr = fbuffer;
    Command *cmd;

    va_start(args, fmt);

    while(*fmt)
    {
        switch(*fmt++)
        {
            case 's':
                bufptr = strcat(bufptr, "\"%s\"");
                break;
            case 'i':
                bufptr = strcat(bufptr, "%d");
                break;
            case 'f':
            case 'd':
                bufptr = strcat(bufptr, "%f");
                break;
            default:
                break;
        }
        if (*fmt)
            bufptr = strcat(bufptr, ",");
    }
    va_end(args);

    switch (etype){
        case ErrorEventType:
        cmd = command_format_jsonk("ERROR", tag, cback, bufptr, args);
        break;

        case CompleteEventType:
        cmd = command_format_jsonk("COMPLETE", tag, cback, bufptr, args);
        break;

        case CancelEventType:
        cmd = command_format_jsonk("CANCEL", tag, cback, bufptr, args);
        break;

        case VerifyEventType:
        cmd = command_format_jsonk("VERIFY", tag, cback, bufptr, args);
        break;

        case CallbackEventType:
        cmd = command_format_jsonk("CALLBACK", tag, cback, bufptr, args);
        break;
    }

    if (command_send(cmd, app->socket) != 0) {
        command_free(cmd);
        return -1;
    } else {
        command_free(cmd);
        return 0;
    }
}


/*
 * jam background loop. This loop is responsible for processing publish-subscribe,
 * survey-respondent, request-reply packets. The C-core does not take
 * unsolicited REQ packets. It is always a REPLY to a previous REQ packet.
 *
 * We launch this loop in a thread. Here is what happens in the loop
 * we read from the network for published and survey packets. This happens on the
 * SUBS and RESP sockets.
 *
 * Process the publsihed events - or messages on the SUBS.
 * Process the survey events - or messages on the RESP sockets
 *
 * Process the REQandREPL packets.. The REQ is an outgoing packet and the REPLY
 * is an incoming packet. Do we have a matching problem? Guess not.

 * When a process writes packets into the thread facing queue, the lock needs to be
 * unlocked..
