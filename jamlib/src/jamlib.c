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
#include "web.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <time.h>

/*
 * Private function prototypes...
 */

Event *_event_setup(Application *app, Command *cmd);
Event *_event_drop(Command *cmd);
Event *_event_drop64(Command *cmd);


// Global variables! This should not be an issue unless we load the library
// more than once. For now, we are not expecting the jamlib to be loaded more than
// once by a program.

Socket *jsocket;

/*
 * This function should be called first... it is responsible for initializing the
 * Jam library.. it takes two arguments pointing to the Jam server (hostname, port).
 * It will fail if the Jam server is down.. so the client program quits if the server is down..
 *
 * We support offline.. by distributed servers.. a server could be located at the local
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

    // save parameters ..
    server = strdup(jam_server);
    sport = int_to_string(port);

    jsocket = socket_new(Socket_Blocking);
    if (socket_connect(jsocket, server, sport) != 0) {
	socket_free(jsocket);
	return -1;
    }

    // select a random sequence number
    seqnum = arc4random() % 1000000;
    // ping the server...
    cmd = command_format_json("PING", "%d", seqnum);

    if (cmd == NULL)
	return -1;
    
    if (command_send(cmd, jsocket) != 0) {
	command_free(cmd);
	return -1;
    }

    // Release the memory for Command.. not needed now
    command_free(cmd);

    // Read the reply from the server...
    cmd = command_read(jsocket);
    if (cmd == NULL)
	printf("ERROR! Unable to get the reply.. \n");

    printf("Helloo..\n");

    // Check if reply is correct.. then we are talking to the correct server.
    if (strcmp(cmd->name, "PINGR") == 0 && cmd->params[0].val.ival == seqnum + 1) {
	command_free(cmd);
	printf("Helloo.. 2 \n");
	return 0;
    } else {
	command_free(cmd);
	return -1;
    }
}



/*
 * Updating functions used by 'live variable' implementations. We have one function per
 * type of variable: int, double, string (char *).
 */

int update_int(Application *app, char *varname, int val)
{
    Command *cmd = NULL;

    cmd = command_format_json("UPDATE", "\"%s\" %d", varname, val);
    if (cmd == NULL)
	return -1;
    
    if (command_send(cmd, app->socket) != 0) {
	command_free(cmd);
	return -1;
    } else {
	command_free(cmd);
	return 0;
    }
}

int update_double(Application *app, char *varname, double val)
{
    Command *cmd = NULL;

    cmd = command_format_json("UPDATE", "\"%s\" %f", varname, val);
    if (cmd == NULL)
	return -1;
    
    if (command_send(cmd, app->socket) != 0) {
	command_free(cmd);
	return -1;
    } else {
	command_free(cmd);
	return 0;
    }
}


int update_string(Application *app, char *varname, char *str)
{
    Command *cmd = NULL;

    cmd = command_format_json("UPDATE", "\"%s\" \"%s\"", varname, str);
    if (cmd == NULL)
	return -1;
    
    if (command_send(cmd, app->socket) != 0) {
	command_free(cmd);
	return -1;
    } else {
	command_free(cmd);
	return 0;
    }
}


int call_user_def(Application *app, char *fmt, ...)
{
    va_list args, cargs;
    char fbuffer[MAX_BUF_SIZE];
    char *bufptr = fbuffer;
    Command *cmd = NULL;

    bufptr = strcat(bufptr, "\"%s\"");

    va_start(args, fmt);
    va_copy(cargs, args);

    while(*fmt)
    {
        switch(*fmt++)
        {
            case 's':
                bufptr = strcat(bufptr, ",\"%s\"");
                break;
            case 'i':
                bufptr = strcat(bufptr, ",%d");
                break;
            case 'f':
            case 'd':
                bufptr = strcat(bufptr, ",%f");
                break;
            default:
                break;
        }
    }
    va_end(args);

    cmd = command_format_jsonk("USER_DEF", bufptr, cargs);

    if (cmd == NULL)
        return -1;
        
    if (command_send(cmd, app->socket) != 0) {
        command_free(cmd);
        return -1;
    } else {
	command_free(cmd);
	return 0;
    }
}
    

Event *get_event(Application *app)
{
    Command *cmd = command_read(app->socket);
    Event *e = NULL;
    int len = 0;
    
    if (cmd == NULL)
        return NULL;
    
    if (cmd->name == NULL)
        return NULL;
    
    len = strlen(cmd->name);

    /* Check for expose */
    if (len == 6 && strncmp(cmd->name, "EXPOSE", 6) == 0) {
        e = event_expose_new();
        return e;
    }
    else if (len == 5 && strncmp(cmd->name, "SETUP", 5) == 0) {
	return _event_setup(app, cmd);
    }
    else if (len == 5 && strncmp(cmd->name, "CLICK", 5) == 0) {
	e = event_click_new(cmd->params[0].val.ival, cmd->params[1].val.ival, cmd->params[2].val.ival);
        return e;
    }
    else if (len == 5 && strncmp(cmd->name, "MDOWN", 5) == 0) {
        e = event_mousedown_new(cmd->params[0].val.ival, cmd->params[1].val.ival, cmd->params[2].val.ival);
        return e;
    }
    else if (len == 5 && strncmp(cmd->name, "MMOVE", 5) == 0) {
	e = event_mousemove_new(cmd->params[0].val.ival, cmd->params[1].val.ival, cmd->params[2].val.ival, cmd->params[3].val.ival);
        return e;
    }
    else if (len == 6 && strncmp(cmd->name, "BCLICK", 6) == 0) {
	e = event_buttonclick_new(cmd->params[0].val.sval);
        return e;
    }
    else if (len == 5 && strncmp(cmd->name, "MDRAG", 5) == 0) {
        e = event_mousedrag_new(cmd->params[0].val.ival, cmd->params[1].val.ival, cmd->params[2].val.ival, cmd->params[3].val.ival, cmd->params[4].val.ival);
        return e;
    }
    else if (len == 8 && strncmp(cmd->name, "MDRAGOUT", 8) == 0) {
        e = event_mousedragout_new(cmd->params[0].val.ival, cmd->params[1].val.ival, cmd->params[2].val.ival, cmd->params[3].val.ival, cmd->params[4].val.ival);
        return e;
    }
    else if (len == 7 && strncmp(cmd->name, "PRELOAD", 7) == 0) {
        e = event_preload_new();
        return e;
    }
    else if (len == 6 && strncmp(cmd->name, "RESIZE", 6) == 0) {
        e = event_resize_new(cmd->params[0].val.ival, cmd->params[1].val.ival);
        return e;
    }
    else if (len == 8 && strncmp(cmd->name, "KEYTYPED", 8) == 0) {
        e = event_key_typed_new(cmd->params[0].val.ival);	
        return e;
    }
    else if (len == 10 && strncmp(cmd->name, "KEYPRESSED", 10)  == 0) {
        e = event_key_pressed_new(cmd->params[0].val.ival);	
        return e;
    }
    else if (len == 11 && strncmp(cmd->name, "KEYRELEASED", 11) == 0) {
        e = event_key_released_new(cmd->params[0].val.ival);	
        return e;
    }
    else if (len == 4 && strncmp(cmd->name, "DROP", 4) == 0) {
	return _event_drop(cmd);
    }
    else if (len == 6 && strncmp(cmd->name, "DROP64", 6) == 0) {
	return _event_drop64(cmd);
    }

    return NULL;
}


Event *_event_setup(Application *app, Command *cmd)
{
    char *str = NULL;
    Event *e;

    e = event_setup_new(cmd->params[0].val.ival, cmd->params[1].val.ival);

    /* 
     * Check the app's callbacks and send registration 
     * message to the browser side as required.
     * 
     * Done in a single message, accumulating hanlders to register.
     * 
     * NB: When adding events, this string might need to grow!
     */

    if (app->callbacks != NULL) {
	str = calloc(REG_CB_MSG_SIZE, sizeof(char));
	if(app->callbacks->clickHandlers != NULL) {
	    strcat(str, "\"CLICK\" ");
	}
	if(app->callbacks->mouseMoveHandlers != NULL) {
	    strcat(str, "\"MMOVE\" ");
	}
	if(app->callbacks->mouseDownHandlers != NULL) {
	    strcat(str, "\"MDOWN\" ");
	}
	if(app->callbacks->mouseDragHandlers != NULL) {
	    strcat(str, "\"MDRAG\" ");
	}
	if(app->callbacks->mouseDragOutHandlers != NULL) {
	    strcat(str, "\"MDRAGOUT\" ");
	}
	if(app->callbacks->buttonClickHandlers != NULL) {
	    strcat(str, "\"BCLICK\" ");
	}
	if(app->callbacks->fileDropInitHandlers != NULL ||
	   app->callbacks->b64FileDropInitHandlers != NULL) {
	    /* A single callback handler for both un-encoded and base64 encoded transfers */
	    strcat(str, "\"DROP\" ");
	}
	if(app->callbacks->resizeHandlers != NULL) {
	    strcat(str, "\"RESIZE\" ");
	}
	if (strlen(str) > 0) {
	    /* Change all but the last space to a comma. Only need to do this if one of the callbacks is used */
	    int i = 0;
	    for(i = 0; i < strlen(str)-1; i++) {
		if (str[i] == ' ') {
		    str[i] = ',';
		}
	    }
	    /* Eventually, check the return value to determine success here */
	    send_register_callback_msg(app, str);
	}
	free(str);

	/* Register keyboard handlers if any */
	CallbackList *cb = app->callbacks->keyTypedHandlers;
	if (cb != NULL) {
	    send_keyboard_callback_msg(app, "CB_KEY_T", (char *)cb->data);
	}
	cb = app->callbacks->keyPressedHandlers;
	if (cb != NULL) {
	    send_keyboard_callback_msg(app, "CB_KEY_P", (char *)cb->data);
	}
	cb = app->callbacks->keyReleasedHandlers;
	if (cb != NULL) {
	    send_keyboard_callback_msg(app, "CB_KEY_R", (char *)cb->data);
	}
    }
    return e;
}


Event *_event_drop(Command *cmd)
{
    Event *e = NULL;

    /* It's a paired message approach. First message sets the event
     * metadata and establishes the number of chunks required for transfer.
     *
     * Message 0 format:
     *         EVENT DROP INIT <filename> <filetype> <filesize>
     *         Caveat: Filetype might not be known. Javascript support for it seems dodgy.
     *
     * 1 to N-1 Message pairs then follow in the format:
     *         a. EVENT DROP CHUNK <filename> <filetype> <filesize> <current chunk>
     *         b. <file chunk X>
     *
     * Final Message format:
     *         EVENT DROP END <filename> <filetype> <filesize>
     */
    char *name    = strdup(cmd->params[1].val.sval);
    char *type    = strdup(cmd->params[2].val.sval);
    unsigned int size    = cmd->params[3].val.ival;
    unsigned int nchunks    = CEIL((double)(size / CHUNKSIZE));

    if ( (strlen(cmd->params[0].val.sval) == 5) && strncmp(cmd->params[0].val.sval, "CHUNK", 5) == 0 ) {
	/* This is a filechunk pair */
	unsigned int chunk_size    = cmd->params[4].val.ival;
	unsigned int cur_chunk    = cmd->params[5].val.ival;
	char buf[CHUNKSIZE];
	//int ret = 0;

	//ret = socket_read(app->socket, buf, chunk_size);

	e = event_filedrop_chunk_new(name, type, size, nchunks, chunk_size, cur_chunk, buf);
	return e;
    } else if ( (strlen(cmd->params[0].val.sval) == 3) && strncmp(cmd->params[0].val.sval, "END", 3) == 0 ) {
	/* This is the end of the transfer */
	e = event_filedrop_end_new(name, type, size, nchunks);
	return e;
    } else {
	/* Filedrop Initalisation */
	e = event_filedrop_init_new(name, type, size, nchunks);
	return e;
    }
}


Event *_event_drop64(Command *cmd)
{
    Event *e = NULL;

    /* The client application is responsible for base64 decoding
     */
    char *name    = strdup(cmd->params[1].val.sval);
    char *type    = strdup(cmd->params[2].val.sval);
    unsigned int o_size    = cmd->params[3].val.ival;

    if ( (strlen(cmd->params[0].val.sval) == 5) && strncmp(cmd->params[0].val.sval, "CHUNK", 5) == 0 ) {
	/* This is a filechunk pair */
	unsigned int e_size    = cmd->params[4].val.ival;
	unsigned int chunk_size    = cmd->params[5].val.ival;
	unsigned int cur_chunk    = cmd->params[6].val.ival;

	unsigned int nchunks    = CEIL((double)(e_size / CHUNKSIZE));

	char buf[CHUNKSIZE];
	//int ret = 0;

	//ret = socket_read(app->socket, buf, chunk_size);

	e = event_filedrop64_chunk_new(name, type, o_size, e_size, nchunks, chunk_size, cur_chunk, buf);
	return e;
    } else if ( (strlen(cmd->params[0].val.sval) == 3) && strncmp(cmd->params[0].val.sval, "END", 3) == 0 ) {
	/* This is the end of the transfer */
	unsigned int e_size    = cmd->params[4].val.ival;
	unsigned int nchunks    = CEIL((double)(e_size / CHUNKSIZE));
	e = event_filedrop64_end_new(name, type, o_size, e_size, nchunks);
	return e;
    } else {
	/* Filedrop Initalisation */
	/* NB we don't actually know the encoded filesize nor the number of chunks yet */
	e = event_filedrop64_init_new(name, type, o_size);
	return e;
    }
}



void register_callback(Application *app, EventType etype, EventCallback cb, void *data)
{
    callbacks_add(app->callbacks, etype, cb, data);
}


void main_loop(Application *app)
{
    Event *e = NULL;
    while ((e = get_event(app))) {
        callbacks_call(app->callbacks, app, e);
    }
}



