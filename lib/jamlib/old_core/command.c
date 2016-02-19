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


/*
 * Handles the JAM protocol .. uses a JSON parser..
 */

#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>

#include "command.h"
#include "jparser.h"


/* Maximum size of input buffer */
#define BUFSIZE         1024

static Command *_command_from_json(char *str);

/*
 * Return a command in JSON format that can be sent to the cloud/web.
 *
 * The format is a 4-member object:
 *         name: function name (command name)
 *         tag: additional matching tag (activity name)
 *         args: array of arguments to the function (variable number)
 *         cback: callback function name
 *
 * Limitations: The JSON object is limited in length to 1024 characters.
 * You should NOT have a control message that is larger than that.. this is
 * not meant for sending for arbitrary data!
 *
 */
Command *command_format_json(const char *name, const char *tag, const char *cback, const char *format, ...)
{
    va_list args;
    int i;
    char buf[BUFSIZE];
    char *json;
    char json_format[] = "{\"name\":\"%s\", \"tag\":\"%s\", \"args\":[%s], \"cback\":\"%s\"}\n";
    int ret;
    Command *cmd = NULL;
    char* new_format;
    int count = 0; /* this counts additional overhead chars */

    if (format == NULL)
        return NULL;
    /*
     * Strings NEED to be properly quoted, return NULL if we
     * find an unquoted string.
     */
    for(i = 0; i < strlen(format); i++) {
        if (format[i] == '%' && format[i+1] == 's') {
            count += 2;
            if (format[i-1] != '"' || format[i+2] != '"') {
                return NULL;
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
    ret = sprintf(json, json_format, name, tag, buf, cback);

    if (json <= 0)
        return NULL;

    cmd = (Command *) calloc(1, sizeof(Command));               /* allocates and initialized to 0 - 1 unit of Command */
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;
    /* Parameters are not saved here.. so no need to worry about the type.. */

    cmd->command = strdup(json);
    free(json);
    free(new_format);

    return cmd;
}

Command *command_format_jsonk(char *name, char *tag, char *cback, char *format, va_list args)
{
    char buf[BUFSIZE];
    char *json;
    char json_format[] = "{\"name\":\"%s\", \"tag\":\"%s\", \"args\":[%s], \"cback\":\"%s\"}\n";
    int ret;
    Command *cmd = NULL;

    if (format == NULL)
        return NULL;

    ret = vsnprintf(buf, BUFSIZE, format, args);

    json = calloc((strlen(json_format) + strlen(name) + BUFSIZE), sizeof(char));
    ret = sprintf(json, json_format, name, tag, buf, cback);

    if (json == NULL)
        return NULL;

    cmd = (Command *) calloc(1, sizeof(Command));               /* allocates and initialized to 0 - 1 unit of Command */
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;
    /* Parameters are not saved here.. so no need to worry about the type.. */

    cmd->command = strdup(json);
    free(json);

    return cmd;
}


void command_free(Command *cmd)
{
    if (cmd == NULL)
        return;

    if (cmd->parsedCmd != NULL)
        free_value(cmd->parsedCmd, 1);

    if (cmd->command != NULL)
        free (cmd->command);

    free (cmd);
    return;
}

int command_send(Command *cmd, Socket *sock)
{
    int ret = 0;
    int len = 0;

    if (cmd == NULL || sock == NULL)
        return -1;

    len = strlen(cmd->command);
    ret = socket_write(sock, cmd->command, len);

    if (ret == len)
        return 0;

    return -1;
}

Command *command_read(Socket *socket)
{
    Command *cmd = NULL;
    char *line = NULL;

    if (socket == NULL)
        return NULL;

    if (wait_until_data_available(socket) < 0)
        return NULL;

    line = socket_readline(socket, "\n");

    cmd = _command_from_json(line);
    if (cmd == NULL) {
        printf("ERROR! Unable to read message from server.. \n");
        printf("Aborting.\n");
        exit(1);
    }

    free(line);
    return cmd;
}

JSONValue *_get_arr_elem(JSONValue *p, int i)
{
    JSONArray *arr = p->val.aval;
    if (i < arr->length)
        return &(arr->elems[i]);
    else {
        printf("ERROR! Out-of-bound array access attempted\n");
        exit(1);
    }
    /* Never reached.. just to make the compiler happy! */
    return NULL;
}

int int_from_params(JSONValue *p, int i)
{
    JSONValue *val = _get_arr_elem(p, i);
    if (val->type == INTEGER)
        return val->val.ival;
    else {
        printf("ERROR! Incorrect parameter type at location - %d:\n", i);
        exit(1);
    }
}


char *string_from_params(JSONValue *p, int i)
{
    JSONValue *val = _get_arr_elem(p, i);
    if (val->type == STRING)
        return val->val.sval;
    else {
        printf("ERROR! Incorrect parameter type at location - %d:\n", i);
        exit(1);
    }
}

double double_from_params(JSONValue *p, int i)
{
    JSONValue *val = _get_arr_elem(p, i);
    if (val->type == DOUBLE)
        return val->val.dval;
    else {
        printf("ERROR! Incorrect parameter type at location - %d:\n", i);
        exit(1);
    }
}

JSONValue *object_from_params(JSONValue *p, int i)
{
    JSONValue *val = _get_arr_elem(p, i);
    if (val->type == OBJECT)
        return val;
    else {
        printf("ERROR! Incorrect parameter type at location - %d:\n", i);
        exit(1);
    }
}


static Command *_command_from_json(char *json)
{
    Command *cmd = NULL;
    JSONValue *jval = NULL;

    if (json == NULL)
	return NULL;

    /* initialize the parser */
    init_parse(json);

    if (parse_value() == ERROR) return NULL;  /* we have invalid JSON, return NULL */
    /* Otherwise.. string has been parsed into JSON */

    cmd = (Command *) calloc(1, sizeof(Command));
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;
    /* Get a handle to the parsed JSON value.. */
    jval = get_value();

    JSONValue *nval = query_value(jval, "s", "name");
    JSONValue *tval = query_value(jval, "s", "tag");
    JSONValue *aval = query_value(jval, "s", "args");   /* TODO: Should the format be "d"? */
    JSONValue *cval = query_value(jval, "s", "cback");

    /* fill up the Command structure.. the memory is NOT held by the Command structure
     * it is still held in the JSON object... we free memory be deallocing the JSON object
     * name and tag are mandatory..
     */
    if (nval->type != STRING) return NULL;
    cmd->name = nval->val.sval;

    if (tval->type != STRING) return NULL;
    cmd->tag = tval->val.sval;

    /* callback could be undefined */
    if (cval->type == STRING)
        cmd->callback = cval->val.sval;
    else
        cmd->callback = NULL;

    /* check the array before assigning to cmd params. */
    if (aval->type != ARRAY) return NULL; /* second parameter SHOULD be an ARRAY.. otherwise we reject */
    cmd->params = aval;

    cmd->parsedCmd = jval;
    dispose_value(nval);
    dispose_value(aval);
    dispose_value(tval);
    dispose_value(cval);

    return cmd;
}
