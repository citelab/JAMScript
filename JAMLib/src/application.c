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
 * to call InitJam() to connect with the Jam server. The InitJam() is defined
 * in jamlib.c 
 *
 */

/*
 * Private function prototypes..
 */

int _is_app_registered(char *appname);
int _register_application(char *appname);
int _open_application(char *appname);
int _close_application(int appid);
int _remove_application(int appid);
Application *_get_app_info(int appid);
Application *_process_application(int appid);
Application *_application_from_json(JSONValue *val);



//////////////////////////////////////////////////
// PUBLIC FUNCTIONS -- PART OF THE API ---
//////////////////////////////////////////////////

/*
 * Return NULL, if the given app is already in the app registry.
 * Otherwise, insert the new app in the registry, allocate resources (ports), 
 * Create the socket connection, activate the app, etc.
 *
 */
Application *create_application(char *appname)
{
    int appid;

    // check registry..
    if ((appid = _is_app_registered(appname))) {
	return NULL;
    } else {
	// if not found, create application	
	printf("Trying to create the application %s\n", appname);
	appid = _register_application(appname);
    }
    printf("_process application \n");
    return _process_application(appid);
}



/*
 * Open a previously registered application. If the application is already active,
 * this function returns NULL.
 * Otherwise, we allocate the resources and reactivate the application. Resources (ports)
 * are released when the application is deactivated by the closeApplication()
 *
 * THIS FUNCTION IS USED AT RESTART.. createApplication is used at the 
 * VERY FIRST TIME.
 */
Application *open_application(char *appname)
{
    int appid;

    // Open application .. return code indicates success or not
    if ((appid = _open_application(appname)) == 0) {
	printf("ERROR! Unable to open application %s\n", appname);
	return NULL;
    }

    return _process_application(appid);
}



int close_application(Application *app)
{
    printf("Closing... 1 \n");
     if (app == NULL)
        return 0;
    printf("Closing... 2 \n");
    // Ask server to close the app...
    if (!_close_application(app->appid)) {
	printf("ERROR! Unable to close application %s\n", app->appname);
	return 0;
    }
    printf("Closing... 3 \n");
    // Release local resources...
    printf("Closing application.. %s\n", app->appname);
    if (app->callbacks != NULL)
        callbacks_free(app->callbacks);

    socket_free(app->socket);

    free(app);
    return 1;
}



/*
 * This is equivalent to "uninstalling the application".
 * This may not be used often... could it be useful?
 */
int remove_application(Application *app)
{
    if (app == NULL)
	return 0;

    // Ask server to remove the app..
    if (_remove_application(app->appid)) {
	printf("ERROR! Unable to remove application %s\n", app->appname);
	return 0;
    }

    // Release local resources...
    printf("Closing application.. %s\n", app->appname);
    if (app->callbacks != NULL)
        callbacks_free(app->callbacks);

    socket_free(app->socket);

    free(app);
    return 1;
}


//////////////////////////////////////////////////
// PRIVATE FUNCTIONS -- NOT PART OF THE API ---
//////////////////////////////////////////////////


/*
 * check the registry for the given application.. return 0
 * if not found or cannot connect to the registry..
 * Otherwise, return a positive number (appID > 0)
 */
int _is_app_registered(char *appname) 
{
    Command *cmd;
    int state;

    printf("Check server.. %s\n", appname);
    // Check with the server...
    cmd = command_format_json("CHKREG", "\"%s\"", appname);
    if (cmd == NULL)
	return 0;
    printf("Check server.. 2 \n");

    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return 0;
    } 
    command_free(cmd);

    printf("Check server.. 3 \n");
    // Read the reply from the server...
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    printf("Check server.. 4 \n");
    // we get (appID > 0) from the server if the app is already registered
    if (strcmp(cmd->name, "APPSTAT") == 0) {
	state = cmd->params[0].val.ival;
	command_free(cmd);
	return state;
    } else {
	command_free(cmd);
	return 0;
    }
}
	

/*
 * Register the application with the given name.. return 0
 * on failure, return a positive number (appID > 0) on success.
 */
int _register_application(char *appname)
{
    Command *cmd;
    int state;

    // Register application
    cmd = command_format_json("REGAPP", "\"%s\"", appname);
    if (cmd == NULL)
	return 0;

    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return 0;
    } 
    command_free(cmd);

    // Read the reply from the server...
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    if (strcmp(cmd->name, "APPSTAT") == 0) {
	state = cmd->params[0].val.ival;
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
    int state;

    // Open application
    cmd = command_format_json("OPNAPP", "\"%s\"", appname);
    if (cmd == NULL)
	return 0;

    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return 0;
    } 
    command_free(cmd);

    // Read the reply from the server...
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    if (strcmp(cmd->name, "APPSTAT") == 0) {
	state = cmd->params[0].val.ival;
	command_free(cmd);
	return state;
    } else {
	command_free(cmd);
	return 0;
    }
}


/*
 * Returns 1 (non zero), if successful in closing..
 * Returns 0 if failed to close the app at the server..
 */
int _close_application(int appid)
{
    Command *cmd;
    int state;

    // Close application
    cmd = command_format_json("CLOSAPP", "%d", appid);
    if (cmd == NULL)
	return 0;

    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return 0;
    } 
    command_free(cmd);

    // Read the reply from the server...
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    // Server returns 0 if the app is closed.. the function
    // returns 1 if the app is actually closed.
    if (strcmp(cmd->name, "APPSTAT") == 0) {
	state = cmd->params[0].val.ival;
	command_free(cmd);
	return !state;
    } else {
	command_free(cmd);
	return 0;
    }
}


int _remove_application(int appid)
{
    Command *cmd;
    int state;

    // Remove application
    cmd = command_format_json("REMAPP", "%d", appid);
    if (cmd == NULL)
	return 0;

    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return 0;
    } 
    command_free(cmd);

    // Read the reply from the server...
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    // Server returns 0 if the app is closed.. the function
    // returns 1 if the app is actually closed.
    if (strcmp(cmd->name, "APPSTAT") == 0) {
	state = cmd->params[0].val.ival;
	command_free(cmd);
	return !state;
    } else {
	command_free(cmd);
	return 0;
    }
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

    // Register the application
    //
    cmd = command_format_json("GAPPINFO", "%d", appid);
    if (cmd == NULL)
	return NULL;

    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return NULL;
    } 
    command_free(cmd);

    // Read the reply from the server...
    printf("Reading the reply from the server........................\n");
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    printf("Appinfo %s\n", cmd->params[0].val.sval);

    if (strcmp(cmd->name, "APPINFO") == 0) {
	app = _application_from_json(cmd->parsedCmd);
	command_free(cmd);
	printf("HeLLLLLLOOO \n");
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

    printf("Step .. 1\n");
    // get information on application
    app = _get_app_info(appid);
    if (app == NULL) {
	printf("ERROR! Unable to get information on application.\n");
	return NULL;
    }

    printf("Step .. 2\n");
    // Connect socket to application service on server
    port_buf = int_to_string(app->port);
    if (port_buf == NULL)
        return NULL;

    printf("Step .. 3 opening %s to port %s\n", app->server, port_buf);

    app->socket = socket_new(Socket_Blocking);
    if (socket_connect(app->socket, app->server, port_buf) != 0) {
        socket_free(app->socket);
        free(port_buf);
        return NULL;
    }

    printf("Step 4\n");
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
    
    // Allocate the data structure for application..
    app = (Application *) calloc(1, sizeof(Application));

    // copy the value into the application structure.. memory will be held by Application

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
