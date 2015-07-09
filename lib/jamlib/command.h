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

#ifdef __cplusplus
extern "C" {
#endif

#ifndef _COMMAND_H
#define _COMMAND_H

#include "socket.h"
#include "json.h"

#include <stdarg.h>

#define MAX_PARAMS                   16

/*
 * A structure to hold the outgoing and incoming command. An incoming command (in JSON format) is parsed
 * and the values are populated in 'name' and 'params'. The param_type holds the type of the parameter.
 * We do only a level one parse. We assume the following format for the incoming message.
 * {name: NAME, args: ARRAY of ARGS, sign: SIGNATURE}
 * The ARRAY of ARGS could hold other objects as well. In that case, they are not parsed any further.
 * It is better to use the parsedCmd to descipher the message further.
 */

typedef struct _Command
{
    char *name;                             // Name of the command
    char *tag;
    JSONValue *params;                      // Parameters is a JSON array
    char *command;                          // The full command
    unsigned int param_count;               // Number of parameters
    char *callback;                         // Name of the callback function from remote
    unsigned int max_params;
    char *signature;
    JSONValue *parsedCmd;                   // Parsed command - full JSON - should be freed - only for incoming
} Command;


Command *command_format(const char *format, ...);
Command *command_format_json(const char *name, const char *tag, const char *cback, const char *format, ...);
Command *command_format_jsonk(char *name, char *tag, char *cback, char *format, va_list args);
void command_free(Command *cmd);


int command_send(Command *cmd, Socket *socket);

Command *command_read(Socket *socket);

int int_from_params(JSONValue *p, int i);
char *string_from_params(JSONValue *p, int i);
double double_from_params(JSONValue *p, int i);
JSONValue *object_from_params(JSONValue *p, int i);


#endif /* _COMMAND_H */

#ifdef __cplusplus
}
#endif
