/*

The MIT License (MIT)
Copyright (c) 2011 Derek Ingrouville, Julien Lord, Muthucumaru Maheswaran

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

#include "jamlib.h"
#include "command.h"
#include "socket.h"
#include "utils.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <time.h>
#include <pthread.h>

/* Maximum size of input buffer TODO: Analysis to figure out a good candidate value */
#define BUFSIZE         256

/*
 * Prototypes for private functions..
 */

Event *get_event(Application *app);
void *event_loop(void *arg);



/* Global variables! This should not be an issue unless we load the library
 * more than once. For now, we are not expecting the jamlib to be loaded more than
 * once by a program.
 */

Socket *jsocket;


/*
 * This function should be called first... it is responsible for initializing the
 * JAM library.. it takes two arguments pointing to the Jam server (hostname, port).
 * It will fail if the JAM server is down.. so the client program quits if the server is down..
 *
 * We could support offline by distributed servers.. a server could be located at the local
 * proximity. Now, consistency could be an issue..
 *
 * This function affects a GLOBAL variable - jsocket -
 */

int init_jam(char *jam_server, int port)
{
    Command *cmd = NULL;
    char *server;
    char *sport;
    int seqnum;

    /* save parameters .. */
    server = strdup(jam_server);
    sport = int_to_string(port);

    jsocket = socket_new(Socket_Blocking);
    if (socket_connect(jsocket, server, sport) != 0) {
        socket_free(jsocket);
        return -1;
    }

    /* select a random sequence number */
    srand(time(NULL));
    seqnum = rand();
    /* ping the server... */
    cmd = command_format_json("PING", "", "", "%d", seqnum);

    if (cmd == NULL)
        return -1;

    if (command_send(cmd, jsocket) != 0) {
        command_free(cmd);
        return -1;
    }

    /* Release the memory for Command.. not needed now */
    command_free(cmd);

    /* Read the reply from the server... */
    cmd = command_read(jsocket);
    if (cmd == NULL) {
        printf("Unable to get the reply.. \n");
        printf("ERROR! Initializing JAMLib aborted..\n");
        exit(1);
    }

    int ival = int_from_params(cmd->params, 0);
    /* Check if reply is correct.. then we are talking to the correct server. */
    if (strcmp(cmd->name, "PINGR") == 0 && ival == seqnum + 1) {
        command_free(cmd);
        return 0;
    } else {
        command_free(cmd);
        return -1;
    }
}


/*
 * Goal: Open the given application - appname.
 * Try to open the application, if does succeed fine. Otherwise, create the
 * application. This could fail due to some reason. In that case, return NULL.
 *
 * NOTE: This method is executed before the eventloop starts running. So we need
 * to receive the messages manually.
 */
Application *open_application(char *appname)
{
    int appid;

    /* Open application .. return code indicates success or not */
    if ((appid = _open_application(appname)) == 0) {
        /* failed to open the application.. may be a new application?
         * create it.
         */
        appid = _register_application(appname);
        if (appid == 0) {
            printf("ERROR! Unable to open or create the application: %s", appname);
            exit(1);
        }
    }
    return _process_application(appid);
}


/* Returns 0 on success and -1 otherwise */
int close_application(Application *app)
{
    void *rval;

    if (app == NULL)
        return -1;

    /* Ask server to close the app... */
    if (!_close_application(app->appid)) {
        printf("ERROR! Unable to close application %s\n", app->appname);
        return -1;
    }

    /* Release local resources... */
    if (app->callbacks != NULL)
        callbacks_free(app->callbacks);

    socket_free(app->socket);

    pthread_join(app->evthread, &rval);

    free(app);
    return 0;
}


/*
 * This is equivalent to "uninstalling the application".
 * This may not be used often... could it be useful?
 * Returns 0 on success and -1 otherwise.
 */
int remove_application(Application *app)
{
    if (app == NULL)
        return -1;

    /* Ask server to remove the app.. */
    if (_remove_application(app->appid)) {
        printf("ERROR! Unable to remove application %s\n", app->appname);
        return -1;
    }

    /* Release local resources... */
    if (app->callbacks != NULL)
        callbacks_free(app->callbacks);

    socket_free(app->socket);
    free(app);
    return 0;
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


void register_callback(Application *app, char *aname, EventType etype, EventCallback cb, void *data)
{
    callbacks_add(app->callbacks, aname, etype, cb, data);
}


void bg_event_loop(Application *app)
{

    int rval = pthread_create(&(app->evthread), NULL, event_loop, (void *)app);
    if (rval != 0) {
        perror("ERROR! Unable to start the background event loop");
        exit(1);
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


/* Private functions...
 * TODO: Trace the memory allocated to the command structure...
 * Seems like it is not released when the incoming message contains an event?
 */
void *event_loop(void *arg)
{
    Application *app = (Application *)arg;
    Event *e = NULL;

    while ((e = get_event(app))) {
        if (e != NULL)
            callbacks_call(app->callbacks, app, e);
    }

    /* Just a dummy return.. return value inconsequential.. */
    return NULL;
}

Event *get_event(Application *app)
{
    Command *cmd = command_read(app->socket);

    int len = 0;

    if (cmd == NULL)
        return NULL;

    if (cmd->name == NULL)
        return NULL;

    len = strlen(cmd->name);

    if (len == 5 && strncmp(cmd->name, "ERROR", 5) == 0) {
        return event_error_new(cmd->tag, cmd->params, cmd->callback);
    }

    if (len == 8 && strncmp(cmd->name, "COMPLETE", 8) == 0) {
        return event_complete_new(cmd->tag, cmd->params, cmd->callback);
    }

    if (len == 6 && strncmp(cmd->name, "CANCEL", 6) == 0) {
        return event_cancel_new(cmd->tag, cmd->callback);
    }

    if (len == 6 && strncmp(cmd->name, "VERIFY", 6) == 0) {
        return event_verify_new(cmd->tag, cmd->callback);
    }

    if (len == 8 && strncmp(cmd->name, "CALLBACK", 8) == 0) {
        return event_callback_new(cmd->tag);
    }

    return NULL;
}
