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
#include "web.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>


/* Specifies a list of characters which should NOT be passed to the browser */
/* ie that sets the listeners to return false */
int disable_key_list(Application *app, EventType etype, char* list)
{
    Command *cmd = NULL;
    Socket *socket = NULL;
    int i,size;
    char *str, args[10];
    char *name;

    if (etype == KeyPressed)
        name = strdup("CB_KEY_P_STOP");
    else if (etype == KeyTyped)
        name = strdup("CB_KEY_T_STOP");
    else
        return -2;

    socket = app->socket;

    if (list == NULL) {
        cmd = command_format_json(name, "\"%s\"", "NONE");
    } else if (strcmp(list, "ALL") == 0 ) {
        cmd = command_format_json(name, "\"%s\"", "ALL");
    } else {
        size = strlen(list);
        str = calloc(size*5, sizeof(char));
        for (i = 0; i < size; i ++) {
            if (i != size -1) sprintf(args, "%u,", list[i]);
            else sprintf(args, "%u", list[i]);
            strcat(str, args);
        }
        cmd = command_format_json(name, "%s", str);
        free(str);
    }
    free(name);

    if (cmd == NULL)
        return -1;

    if (command_send(cmd, socket) != 0) {
        command_free(cmd);
        return -3;
    }
    return 0;
}


int send_register_callback_msg(Application *app, char* events) 
{
    Command *cmd = NULL;
    Socket *socket = NULL;

    socket = app->socket;

    /*cmd = command_format("REG_CB %s", events); */
    /* this is a special case since the strings are already quoted */
    cmd = command_format_json("REG_CB", "%s", events);
    if (cmd == NULL)
        return -1;

    if (command_send(cmd, socket) != 0) {
        command_free(cmd);
        return -1;
    }

    return 0;
}


int send_keyboard_callback_msg(Application *app, char* type, char* list)
{
    Command *cmd = NULL;
    Socket *socket = NULL;
    int i,size;
    char *str, args[10];

    socket = app->socket;

    if (list == NULL) {
        cmd = command_format_json(type, "\"%s\"", "ALL");
    } else {
        size = strlen(list);
        str = calloc(size*5, sizeof(char));
        for (i = 0; i < size; i ++) {
            if (i != size -1) sprintf(args, "%u,", list[i]);
            else sprintf(args, "%u", list[i]);
            strcat(str, args);
        }
        cmd = command_format_json(type, "%s", str);
        free(str);
    }

    if (cmd == NULL)
        return -1;

    if (command_send(cmd, socket) != 0) {
        command_free(cmd);
        return -1;
    }

    return 0;
}


/* Create a list properly null-terminated list of characters for keyboard callbacks */
char* keyboard_list_builder(int num, ...)
{
    char *list;
    va_list args;
    int i;

    /* +1 for NULL terminator */
    list = calloc(num+1, sizeof(char));

    va_start(args, num);
    for(i = 0; i < num; i++) {
        list[i] = va_arg(args, int);
    }
    va_end(args);

    list[num] = '\0';

    return list;
}

