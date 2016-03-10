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
    js->queue = queue_new(true);

    // Start the event processing background thread..
    jam_event_loop(js);

    return js;
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
// This is temporary..
// TODO: Make it truely single threaded. We need run the user functions and background
// task commits in the same thread. This needs some form of cooperative processing.
//
//
void jam_event_loop(jamstate_t *js)
{
    int rval = pthread_create(&(js->bgthread), NULL, jam_event_processor, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the background event loop");
        exit(1);
    }
}


/* Private functions...
 * TODO: Trace the memory allocated to the command structure...
 * Seems like it is not released when the incoming message contains an event?
 */
void *jam_event_processor(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    event_t *e = NULL;

    while ((e = get_event(js))) {
        if (e != NULL)
            callbacks_call(js->callbacks, app, e);
    }

    /* Just a dummy return.. return value inconsequential.. */
    return NULL;
}



// TODO: This needs to revamped. Timeouts come here too.
// The RPC processing is complicated.. it could have changes here too.
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

    len = strlen(cmd->cmd);

    if (len == 5 && strncmp(cmd->name, "ERROR", 5) == 0) {
        return event_error_new(cmd->tag, cmd->params, cmd->callback);
    }

    if (len == 8 && strncmp(cmd->name, "COMPLETE", 8) == 0) {
        return event_complete_new(cmd->tag, cmd->params, cmd->callback);
    }

    if (len == 8 && strncmp(cmd->name, "CALLBACK", 8) == 0) {
        return event_callback_new(cmd->tag);
    }

    return NULL;
}


void jam_reg_callback(jamstate_t *js, char *aname, eventtype_t etype, event_callback_f cb, void *data)
{
    callbacks_add(js->callbacks, aname, etype, cb, data);
}


// This could be complicated!
// Launch the execution request. Wait for the reply and get the lease time..
// We fail the exec request, if we are unable to get the first part done
// We need some way of tracking the progress of the launched task.
// Lease extensions and completions are tracked here.
// Send a message to the queue() seeking a timeout..
//
//
bool jam_execute_func(jamstate_t *js, const char *fname, const char *fmt, ...)
{


}



int jam_raise_event(jamstate_t *js, char *tag, EventType etype, char *cback, char *fmt, ...)
{

}


/* Returns 0 on success and -1 otherwise */
int execute_remote_func(Application *app, const char *name, const char *format, ...)
{
    va_list args;
    int i;
    char buf[BUFSIZE];
    char *json;
    char json_format[] = "{\"name\":\"%s\", \"args\":[%s], \"sign\":\"%s\"}\n";
    int ret;
    Command *cmd = NULL;
    char* new_format;
    int count = 0; /* this counts additional overhead chars */

    if (format == NULL)
        return -1;
    /*
     * Strings NEED to be properly quoted, return NULL if we
     * find an unquoted string.
     */
    for(i = 0; i < strlen(format); i++) {
        if (format[i] == '%' && format[i+1] == 's') {
            count += 2;
            if (format[i-1] != '"' || format[i+2] != '"') {
                return -1;
            }
        }
    }

    /* Format is const so make a usable copy of it to play with */
    new_format = strdup(format);

    /* Replace spaces by commas. This will help for json formatting */
    for(i = 0; i < strlen(new_format); i++) {
        if (new_format[i] == ' ') {
            new_format[i] = ',';
            count++;
        }
    }

    va_start(args, format);
    ret = vsnprintf(buf, BUFSIZE, new_format, args);
    va_end(args);

    json = calloc((strlen(json_format) + strlen(name) + BUFSIZE), sizeof(char));
    ret = sprintf(json, json_format, name, buf, "");

    if (json <= 0)
        return -1;

    cmd = (Command *) calloc(1, sizeof(Command));               /* allocates and initialized to 0 - 1 unit of Command */
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;
    /* Parameters are not saved here.. so no need to worry about the type.. */

    cmd->command = strdup(json);
    free(json);
    free(new_format);

    if (command_send(cmd, app->socket) != 0) {
        command_free(cmd);
        return -1;
    } else {
        command_free(cmd);
        return 0;
    }
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
