/*

The MIT License (MIT)
Copyright (c) 2014 Muthucumaru Maheswaran

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

#include "application.h"
#include "jamlib.h"
#include "jparser.h"
#include "command.h"
#include "socket.h"
#include "utils.h"


#include <string.h>
#include <stdio.h>
#include <stdlib.h>


/*
 * Before any of these "Application" lifecycle functions could be used, we need
 * to call init_jam() to connect with the JAM server. The init_jam() is defined
 * in jamlib.c
 *
 */



/*
 * Register the application with the given name.. return 0
 * on failure, return a positive number (appID > 0) on success.
 */
int _register_application(char *appname)
{
    Command *cmd;

    /* Register application */
    cmd = command_format_json("REGAPP", "", "", "\"%s\"", appname);
    if (cmd == NULL)
        return 0;

    if (command_send(cmd, jsocket) != 0) {
        command_free(cmd);
        return 0;
    }
    command_free(cmd);

    return _get_state_from_server("APPSTAT");
}

int _get_state_from_server(char *statstr) {

    /* Read the reply from the server... */
    Command *cmd = command_read(jsocket);
    if (cmd == NULL) {
        printf("Unable to get the reply.. \n");
        printf("ERROR! Application registering aborted..\n");
        exit(1);
    }

    if (strcmp(cmd->name, statstr) == 0) {
        int state = int_from_params(cmd->params, 0);
        command_free(cmd);
        return state;
    } else {
        command_free(cmd);
        return 0;
    }
}


/*
 * Open a previously registered application. The application
 * was closed by a previous call to close_application().
 * Now we reopen it.
 * Returns (appid > 0) if success or 0 if error (including the app
 * is already open)
 */
int _open_application(char *appname)
{
    Command *cmd;

    /* Open application */
    cmd = command_format_json("OPNAPP", "", "", "\"%s\"", appname);
    if (cmd == NULL)
        return 0;

    if (command_send(cmd, jsocket) != 0) {
        command_free(cmd);
        return 0;
    }
    command_free(cmd);

    return _get_state_from_server("APPSTAT");
}

/*
 * Returns 1 (non zero), if successful in closing..
 * Returns 0 if failed to close the app at the server..
 */
int _close_application(int appid)
{
    Command *cmd;

    /* Close application */
    cmd = command_format_json("CLOSAPP", "", "", "%d", appid);
    if (cmd == NULL)
        return 0;

    if (command_send(cmd, jsocket) != 0) {
        command_free(cmd);
        return 0;
    }
    command_free(cmd);

    /* TODO: state is inverted by the server
     * fix it..
     */
    return _get_state_from_server("APPSTAT");
}


int _remove_application(int appid)
{
    Command *cmd;    

    /* Remove application */
    cmd = command_format_json("REMAPP", "", "", "%d", appid);
    if (cmd == NULL)
        return 0;

    if (command_send(cmd, jsocket) != 0) {
        command_free(cmd);
        return 0;
    }
    command_free(cmd);

    /* TODO: inversted state. */
    return _get_state_from_server("APPSTAT");
}


/*
 * get app info: given the appID, this function pulls a JSON
 * object containing app information - port number, app name, etc.
 *
 * returns 0 on failure to return value, otherwise returns 1.
 */

Application *_get_app_info(int appid)
{
    Command *cmd;
    Application *app;

    /* Register the application */

    cmd = command_format_json("GAPPINFO", "", "", "%d", appid);
    if (cmd == NULL)
        return NULL;

    if (command_send(cmd, jsocket) != 0) {
        command_free(cmd);
        return NULL;
    }
    command_free(cmd);

    /* Read the reply from the server... */
    cmd = command_read(jsocket);
    if (cmd == NULL) {
        printf("Unable to get the reply.. \n");
        printf("ERROR! Get application info aborted..\n");
        exit(1);
    }

    if (strcmp(cmd->name, "APPINFO") == 0) {
        app = _application_from_json(cmd->parsedCmd);
        command_free(cmd);
        return app;
    } else {
        command_free(cmd);
        return NULL;
    }
}

Application *_process_application(int appid)
{
    Application *app = NULL;
    char *port_buf = NULL;

    /* get information on application */
    app = _get_app_info(appid);
    if (app == NULL) {
        printf("ERROR! Unable to get information on application. Aborted\n");
        exit(1);
    }

    /* Connect socket to application service on server */
    port_buf = int_to_string(app->port);
    if (port_buf == NULL)
        return NULL;

    app->socket = socket_new(Socket_Blocking);
    if (socket_connect(app->socket, app->server, port_buf) != 0) {
        socket_free(app->socket);
        free(port_buf);
        return NULL;
    } else {
        printf("Connected to the servelet... \n");
    }

    free(port_buf);
    app->callbacks = callbacks_new();
    return app;
}


/*
 * recover the Application structure from the JSON
 * Only appid, state, appname, server, and port
 * are available in the JSON
 *
 */
Application *_application_from_json(JSONValue *jval)
{
    Application *app = NULL;
    JSONValue *tval;

    /* Allocate the data structure for application.. */
    app = (Application *) calloc(1, sizeof(Application));

    /* copy the value into the application structure.. memory will be held by Application */

    tval = query_value(jval, "sds", "args", 0, "appid");
    if (tval->type == INTEGER)
        app->appid = tval->val.ival;
    else
        dispose_value(tval);

    tval = query_value(jval, "sds", "args", 0, "state");
    if (tval->type == INTEGER)
        app->state = tval->val.ival;
    else
        dispose_value(tval);

    tval = query_value(jval, "sds", "args", 0, "appname");
    if (tval->type == STRING)
        app->appname = strdup(tval->val.sval);
    else
        dispose_value(tval);

    tval = query_value(jval, "sds", "args", 0, "server");
    if (tval->type == STRING)
        app->server = strdup(tval->val.sval);
    else
        dispose_value(tval);

    tval = query_value(jval, "sds", "args", 0, "port");
    if (tval->type == INTEGER)
        app->port = tval->val.ival;
    else
        dispose_value(tval);

    return app;
}


/*
 * Release the memory associated with the struct 'Application'
 */
void application_free(Application *app)
{
    free(app->appname);
    free(app->server);
    socket_free(app->socket);
    callbacks_free(app->callbacks);
    free(app);
}


/*
 * Print the application information..
 */
void print_application(Application *app)
{
    printf("\nApplication - name:    %s\n", app->appname);
    printf("\n            - appid:   %d", app->appid);
    printf("\n            - state:   %d", app->state);
    printf("\n            - server:  %s", app->server);
    printf("\n            - port:    %d\n\n", app->port);
}
