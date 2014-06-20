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
int _get_app_info(int appid, char *appinfo);
Application *_process_application(int appid);
Application *_application_from_json(char *ainfo);



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
	appid = _register_application(appname);
    }

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
    if ((appid = _open_application(appname))) {
	printf("ERROR! Unable to open application %s\n", appname);
	return NULL;
    }

    return _process_application(appid);
}



int close_application(Application *app)
{
    if (app == NULL)
        return 0;

    // Ask server to close the app...
    if (_close_application(app->appid)) {
	printf("ERROR! Unable to close application %s\n", app->appname);
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

    // Check with the server...
    cmd = command_format_json("CHKREG", "%s", appname);
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

    // we get 1 from the server if the app is already registered
    if (strcmp(cmd->name, "APPSTAT") == 0) {
	state = cmd->params[0].ivar;
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
    cmd = command_format_json("REGAPP", "%s", appname);
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
	state = cmd->params[0].ivar;
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
    cmd = command_format_json("OPNAPP", "%s", appname);
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
	state = cmd->params[0].ivar;
	command_free(cmd);
	return state;
    } else {
	command_free(cmd);
	return 0;
    }
}


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
	state = cmd->params[0].ivar;
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
	state = cmd->params[0].ivar;
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

int _get_app_info(int appid, char *appinfo)
{
    Command *cmd;

    // Register the application
    cmd = command_format_json("GAPPINFO", "%d", appid);
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

    if (strcmp(cmd->name, "APPINFO") == 0) {
	appinfo = strdup(cmd->params[0].svar);
	command_free(cmd);
	return 1;
    } else {
	command_free(cmd);
	return 0;
    }
}


Application *_process_application(int appid)
{
    Application *app = NULL;
    Socket *socket = NULL;
    char *port_buf = NULL;
    char *appinfo = NULL;

    // get information on application
    if (_get_app_info(appid, appinfo)) {
	app = _application_from_json(appinfo);
    }

    // Connect socket to application service on server
    port_buf = int_to_string(app->port);
    if (port_buf == NULL)
        return NULL;

    socket = socket_new(Socket_Blocking);
    if (socket_connect(app->socket, app->server, port_buf) != 0) {
        socket_free(app->socket);
        free(port_buf);
        return NULL;
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

Application *_application_from_json(char *ainfo)
{
    Application *app = NULL;
    int length = 0;
    char *key = NULL;
    
    if (ainfo == NULL)
	return NULL;

    length = strlen(ainfo);
    // We cannot have a valid appinfo with less than 5 characters
    if (length < 5)
	return NULL;

    app = (Application *) calloc(1, sizeof(Application));
    app->ainfo = strdup(ainfo);

    init_parse(app->ainfo);

    if (parse_begin_obj()) {
	do {
	    if (parse_string(&key) && strcmp(key, "appid") == 0) {
		if (parse_colon()) {
		    parse_int(&(app->appid));
		}
	    } else if (parse_string(&key) && strcmp(key, "state") == 0) {
		if (parse_colon()) {
		    parse_int(&(app->state));
		}
	    } else if (parse_string(&key) && strcmp(key, "appname") == 0) {
		if (parse_colon()) {
		    parse_string(&(app->appname));
		}
	    } else if (parse_string(&key) && strcmp(key, "server") == 0) {
		if (parse_colon()) {
		    parse_string(&(app->server));
		}
	    } else if (parse_string(&key) && strcmp(key, "port") == 0) {
		if (parse_colon()) {
		    parse_int(&(app->port));
		}
	    }
	} while (parse_comma());
	parse_end_obj();
    }
    return app;
}
	    

/*
 * Release the memory associated with the struct 'Application'
 */

void application_free(Application *app)
{
    

}
