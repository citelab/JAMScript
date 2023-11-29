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

#define TINY_CMD_STR_LEN            16
#define SMALL_CMD_STR_LEN           32
#define LARGE_CMD_STR_LEN           128
#define HUGE_CMD_STR_LEN            1024

typedef struct _arg_t {
    int nargs;
    char type;
    union _argvalue_t {
        int ival;
        long long int lval;
        char* sval;
        double dval;
        nvoid_t* nval;
        void* vval;
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
    char fn_name[LARGE_CMD_STR_LEN];            // Function name
    uint64_t task_id;                           // Task identifier (a function in execution)
    char node_id[LARGE_CMD_STR_LEN];            // this can be the UUID4 of the source of the message
    char old_id[LARGE_CMD_STR_LEN];             // this can be the UUID4 of the original message (only valid in a "reply")
    char fn_argsig[SMALL_CMD_STR_LEN];          // Argument signature of the functions - use fmask format
    unsigned char buffer[HUGE_CMD_STR_LEN];     // TODO: CBOR byte array in raw byte form -- overflow problems ...
    int length;                                 // length of the raw CBOR data

    arg_t* args;                                // List of args

    int refcount;                               // Deallocation control
    pthread_mutex_t lock;
    uint64_t id;
} command_t;


/*
 * Structure for hold internal commands - from the message processor to the executor.
 */
typedef struct _internal_command_t
{
    int cmd;
    uint64_t task_id;
    arg_t *args;
} internal_command_t;

internal_command_t *internal_command_new(command_t *cmd);
void internal_command_free(internal_command_t *ic);

command_t *command_new(int cmd, int subcmd, char *fn_name, uint64_t task_id, char *node_id, char *old_id, char *fn_argsig, ...);
command_t *command_new_using_arg(int cmd, int opt, char *fn_name, uint64_t taskid, char *node_id, char *old_id, char *fn_argsig, arg_t *args);
command_t *command_from_data(char *fn_argsig, void *data, int len);
void command_hold(command_t *cmd);
void command_free(command_t *cmd);
bool command_qargs_alloc(const char *fmt, arg_t **rargs, va_list args);
void command_arg_print(arg_t *arg);
void command_arg_inner_free(arg_t *arg);
void command_args_free(arg_t *arg);
arg_t *command_args_clone(arg_t *arg);
void command_args_copy_elements(arg_t *arg_from, arg_t *arg_to, size_t nargs_from, size_t nargs_to);
void command_print(command_t *cmd);
#ifdef __cplusplus
}
#endif
#endif
