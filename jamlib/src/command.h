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

#include <stdarg.h>


#define MAX_PARAMS                   16

enum ParamType
{
    STRING_TYPE,
    INT_TYPE,
    FLOAT_TYPE,
    DOUBLE_TYPE
};


union Param
{
    int ivar;
    float fvar;
    double dvar;
    long lvar;
    char *svar;
};

typedef struct _Command
{
    char *name;                             // Name of the command 
    union Param params[MAX_PARAMS];         // Parameters 
    int param_type[MAX_PARAMS];             // Parameter type
    char *command;                          // The full command 
    unsigned int param_count;               // Number of parameters 
    unsigned int max_params;
    char *signature;
    char *pdata;                            // Payload data
} Command;

Command *command_format(const char *format, ...);
Command *command_format_json(const char *name, const char *format, ...);
Command *command_format_jsonk(const char *name, const char *format, va_list args);
void command_free(Command *cmd);

int command_send(Command *cmd, Socket *socket);

Command *command_read(Socket *socket);

#endif /* _COMMAND_H */

#ifdef __cplusplus
}
#endif
