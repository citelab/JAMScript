/*

The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

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
#ifndef __COMMAND_H__
#define __COMMAND_H__
#ifdef __cplusplus
extern "C" {
#endif
#include <tinycbor/cbor.h>
#include <stdint.h>
#include <pthread.h>
#include "nvoid.h"


typedef enum {
    NULL_TYPE,
    STRING_TYPE,
    INT_TYPE,
    LONG_TYPE,
    DOUBLE_TYPE,
    NVOID_TYPE,
    VOID_TYPE
} argtype_t;


#define TINY_CMD_STR_LEN            16
#define SMALL_CMD_STR_LEN           32
#define LARGE_CMD_STR_LEN           128
#define HUGE_CMD_STR_LEN            1024

typedef struct _arg_t
{
    int nargs;
    argtype_t type;
    union _argvalue_t
    {
        int ival;
        long int lval;
        char *sval;
        double dval;
        nvoid_t *nval;
        void *vval;
    } val;
} arg_t;



/*
 * A structure to hold the outgoing and incoming command.
 * An outgoing command is parsed into a CBOR formatted byte array and similarly
 * a CBOR formatted byte array is decoded into a CBOR item handle.
 * Also, information is extracted from the CBOR item and inserted into the
 * command structure at the decoding process.
 */
typedef struct _command_t
{
    // Command object is going to hold truncated versions of the parameters 
    // in case longer strings are passed at creation
    // CBOR object is going to hold all the data
    int cmd;
    int subcmd;
    char fn_name[SMALL_CMD_STR_LEN];            // Function name
    long int task_id;                           // Task identifier (a function in execution)
    char node_id[LARGE_CMD_STR_LEN];            // this can be the UUID4 of the node
    char fn_argsig[SMALL_CMD_STR_LEN];          // Argument signature of the functions - use fmask format
    unsigned char buffer[HUGE_CMD_STR_LEN];     // CBOR byte array in raw byte form
    int length;                                 // length of the raw CBOR data

    arg_t *args;                                // List of args

    int refcount;                               // Deallocation control
    pthread_mutex_t lock;
    long id;
} command_t;

command_t *command_new(int cmd, int subcmd, char *fn_name, 
                    long int task_id, char *node_id, char *fn_argsig, ...);
command_t *command_new_using_arg(int cmd, int opt, char *fn_name, long int taskid, char *node_id, char *fn_argsig, arg_t *args);
command_t *command_from_data(char *fn_argsig, void *data, int len);
void command_hold(command_t *cmd);
void command_free(command_t *cmd);
bool command_qargs_alloc(const char *fmt, arg_t **rargs, va_list args);
void command_arg_print(arg_t *arg);
void command_arg_inner_free(arg_t *arg);
void command_arg_free(arg_t *arg);
arg_t *command_args_clone(arg_t *arg);
void command_print(command_t *cmd);
#ifdef __cplusplus
}
#endif
#endif