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
 * Handle the Jam protocol 
 */

#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>

#include "command.h"
#include "jparser.h"


/* Maximum size of input buffer TODO: Analysis to figure out a good candidate value */
#define BUFSIZE         256 

static Command *_command_from_json(char *str);

/*
 * Return a command in JSON format that can be sent to the cloud/web.
 * 
 * The format is a 3-member object:
 *         name: function name
 *         args: array of arguments to the function.
 *         sign: signature on the name and args using security credentials
 * 
 * Limitations: The JSON object is limited in length to 256 characters. 
 * You should NOT have a control message that is larger than that.. this is
 * not meant for sending for arbitrary data!
 *
 */

Command *command_format_json(const char *name,const char *format, ...)
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
        return NULL;
    /* 
     * Strings NEED to be properly quoted, return NULL if we
     * find an unquoted string.
     * 
     * There are exceptions for the Register Callback and keyboard-related functions.
     * It was done for simplicity's sake. It might be revisited eventually
     * but for now, just deal with it. Please and thank you.
     * 
     */
    if ( strcmp(name, "REG_CB") != 0  &&
         strncmp(name, "CB_KEY", 6) != 0 )
    {
        for(i = 0; i < strlen(format); i++) {
            if (format[i] == '%' && format[i+1] == 's') {
                count += 2;
                if (format[i-1] != '"' || format[i+2] != '"') {
                    return NULL;
                }
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
    
    va_start (args, format);
    ret = vsnprintf(buf, BUFSIZE, new_format, args);
    va_end (args);
    
    json = calloc((strlen(json_format) + strlen(name) + BUFSIZE), sizeof(char));
    ret = sprintf(json, json_format, name, buf, "");
    
    if (json <= 0)
        return NULL;

    cmd = (Command *) calloc(1, sizeof(Command));               // allocates and initialized to 0 - 1 unit of Command
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;
    // Parameters are not saved here.. so no need to worry about the type..

    cmd->command = strdup(json);
    free(json);

    return cmd;
}


/*
 * Slightly edited version of the above function.. used only
 * in User defined functions..
 */

Command *command_format_jsonk(const char *name, const char *format, va_list args)
{
    char buf[BUFSIZE];
    char *json;
    char *new_format;
    char json_format[] = "{\"name\":\"%s\", \"args\":[%s], \"sign\":\"%s\"}\n";
    int ret, i;
    Command *cmd = NULL;

    if (format == NULL)
        return NULL;

    /* 
     * Strings NEED to be properly quoted, return NULL if we
     * find an unquoted string.
     * 
     */

    for(i = 0; i < strlen(format); i++) {
	if (format[i] == '%' && format[i+1] == 's') {
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
        }
    }
    
    ret = vsnprintf(buf, BUFSIZE, new_format, args);
    
    json = calloc((strlen(json_format) + strlen(name) + BUFSIZE), sizeof(char));
    ret = sprintf(json, json_format, name, buf, "");
    
    if (json <= 0)
        return NULL;

    cmd = (Command *) calloc(1, sizeof(Command));               // allocates and initialized to 0 - 1 unit of Command
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;
    // Parameters are not saved here.. so no need to worry about the type..

    cmd->command = strdup(json);
    free(json);

    return cmd;
}


void command_free(Command *cmd)
{
    if (cmd == NULL)
        return;

    if (cmd->pdata != NULL)
        free(cmd->pdata);

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

    wait_until_data_available(socket);
    line = socket_readline(socket, "\n");

    cmd = _command_from_json(line);
    printf("Line %s\n", line);
    free(line);

    return cmd;
}


static Command *_command_from_json(char *json)
{
    Command *cmd = NULL;
    char *tmpstr = NULL;
    char *key = NULL;
    int length = 0;

    if (json == NULL)
	return NULL;

    length = strlen(json);
    // We cannot have a valid message with less than 5 characters
    if (length < 5)
	return NULL;

    cmd = (Command *) calloc(1, sizeof(Command));
    cmd->max_params = MAX_PARAMS;
    cmd->param_count = 0;

    cmd->command = strdup(json);
    
    tmpstr = strdup(json);

    // setup the parser
    init_parse(tmpstr);
    
    if (parse_begin_obj()) {
	if (parse_string(&key) && strcmp(key, "name") == 0) {
	    if (parse_colon()) {
		parse_string(&(cmd->name));
	    }
	}
	if (parse_comma()) {
	    
	    if (parse_string(&key) && strcmp(key, "args") == 0) {
		if (parse_colon()) {
		    parse_begin_arr();
		    do {
			if (parse_string(&(cmd->params[cmd->param_count].svar))) {
			    cmd->param_type[cmd->param_count] = STRING_TYPE;
			    cmd->param_count++;
			} else if (parse_int(&(cmd->params[cmd->param_count].ivar))) {
			    cmd->param_type[cmd->param_count] = INT_TYPE;
			    cmd->param_count++;
			}
		    } while (parse_comma());
		    parse_begin_arr();
		}
	    }
	}
	if (parse_comma()) {
	    if (parse_string(&key) && strcmp(key, "sign") == 0) {
		if (parse_colon()) {	    
		    parse_string(&(cmd->signature));
		}
	    }
	}
	parse_end_obj();
    }
    cmd->pdata = tmpstr;
    
    return cmd;
}
