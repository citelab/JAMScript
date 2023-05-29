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

#include "nvoid.h"
#include <cbor.h>
#include <stdint.h>
#include "util.h"

#define CmdNames_REGISTER 1001
#define CmdNames_REGISTER_ACK 1002
#define CmdNames_NEW_REGISTER 1005
#define CmdNames_OLD_REGISTER 1006
#define CmdNames_PING 1020
#define CmdNames_PONG 1021
#define CmdNames_GET_CLOUD_FOG_INFO 1100
#define CmdNames_PUT_CLOUD_FOG_INFO 1101
#define CmdNames_REF_CLOUD_FOG_INFO 1102
#define CmdNames_FOG_ADD_INFO 1150
#define CmdNames_FOG_DEL_INFO 1151
#define CmdNames_CLOUD_ADD_INFO 1152
#define CmdNames_CLOUD_DEL_INFO 1153
#define CmdNames_WHERE_IS_CTRL 1550
#define CmdNames_HERE_IS_CTRL 1551
#define CmdNames_PROBE 2020
#define CmdNames_PROBE_ACK 2110
#define CmdNames_GET_SCHEDULE 3010
#define CmdNames_PUT_SCHEDULE 3020
#define CmdNames_REXEC 5010
#define CmdNames_REXEC_NAK 5020
#define CmdNames_REXEC_ACK 5030
#define CmdNames_REXEC_RES 5040
#define CmdNames_REXEC_ERR 5045
#define CmdNames_REXEC_SYN 5050
#define CmdNames_GET_REXEC_RES 5060
#define CmdNames_COND_FALSE 5810
#define CmdNames_FUNC_NOT_FOUND 5820
#define CmdNames_SET_JSYS 6000
#define CmdNames_CLOSE_PORT 6200


#define CmdNames_STOP 7000


typedef enum
{
    NULL_TYPE,
    STRING_TYPE,
    INT_TYPE,
    LONG_TYPE,
    DOUBLE_TYPE,
    NVOID_TYPE,
    VOID_TYPE
} argtype_t;

#define TINY_CMD_STR_LEN 16
#define SMALL_CMD_STR_LEN 32
#define LARGE_CMD_STR_LEN 128
#define HUGE_CMD_STR_LEN 1024

typedef struct _arg_t
{
    int nargs;
    argtype_t type;
    union _argvalue_t
    {
        int ival;
        long int lval;
        char* sval;
        double dval;
        nvoid_t* nval;
        void* vval;
    } val;
} arg_t;

/*
 * A structure to hold the outgoing and incoming command.
 * An outgoing command is parsed into a CBOR formatted byte array and
 * similarly a CBOR formatted byte array is decoded into a CBOR item handle.
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
    char fn_name[SMALL_CMD_STR_LEN]; // Function name
    uint64_t task_id; // Task identifier (a function in execution)
    char node_id[LARGE_CMD_STR_LEN];        // this can be the UUID4 of the node
    char fn_argsig[SMALL_CMD_STR_LEN];      // Argument signature of the
                                            // functions - use fmask format
    unsigned char buffer[HUGE_CMD_STR_LEN]; // CBOR byte array in raw byte form
    int length;                             // length of the raw CBOR data

    arg_t* args; // List of args

    int refcount; // Deallocation control
    long id;
} command_t;

typedef struct _internal_command_t
{
    int cmd;
    uint32_t task_id;
    arg_t* args;
} internal_command_t;

internal_command_t* internal_command_new(command_t* cmd);
void internal_command_free(internal_command_t* ic);

// Constructors
command_t* command_new(int cmd, int subcmd, const char* fn_name, uint64_t task_id,
                       const char* node_id, const char* fn_argsig, ...);
command_t* command_new_using_arg(int cmd, int opt, const char* fn_name,
                                 uint64_t taskid, const char* node_id,
                                 const char* fn_argsig, arg_t* args);

void command_init_using_arg(command_t* command, int cmd, int opt, const char* fn_name,
                                 uint64_t taskid, const char* node_id,
                                 const char* fn_argsig, arg_t* args);

command_t* command_from_data(char* fn_argsig, void* data, int len);
void command_from_data_inplace(command_t* cmdo, const char* fn_argsig, int len);

// Methods
void command_hold(command_t* cmd);
void command_free(command_t* cmd);
bool command_qargs_alloc(const char* fmt, arg_t** rargs, va_list args);
void command_arg_print(arg_t* arg);
void command_arg_inner_free(arg_t* arg);
void command_args_free(arg_t* arg);
arg_t* command_args_clone(arg_t* arg);
void command_print(command_t* cmd);

#endif