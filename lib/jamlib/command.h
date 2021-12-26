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

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __COMMAND_H__
#define __COMMAND_H__

#include <cbor.h>
#include <stdint.h>
#include <pthread.h>
#include "nvoid.h"

/*
 * TODO: May be we could have user defined structures and unions in the
 * argument definitions. This would help serialization of arbitrary structures.
 * The challenge would be to transfer such data between C and JavaScript.
 */

enum argtype_t {
    NULL_TYPE,
    STRING_TYPE,
    INT_TYPE,
    DOUBLE_TYPE,
    NVOID_TYPE
};

typedef struct _arg_t
{
    enum argtype_t type;
    union _argvalue_t
    {
        int ival;
        char *sval;
        double dval;
        nvoid_t *nval;
    } val;
} arg_t;


typedef struct _rvalue_t
{
    arg_t *qargs;
    cbor_item_t *arr;
    struct alloc_memory_list *list;

} rvalue_t;



/*
 * A structure to hold the outgoing and incoming command.
 * An outgoing command is parsed into a CBOR formatted byte array and similarly
 * a CBOR formatted byte array is decoded into a CBOR item handle.
 * Also, information is extracted from the CBOR item and inserted into the
 * command structure at the decoding process.
 */

typedef struct _command_t
{
    char *cmd;                              // Name of the command
    char *opt;
    char *cond;
    int  condvec;
    char *actname;                          // Activity name
    char *actid;                            // Activity ID
    char *actarg;                           // Activity arg
    unsigned char buffer[1024];             // CBOR byte array in raw byte form
    int length;                             // length of the raw CBOR data
    cbor_item_t *cdata;                     // handle to the CBOR array
    cbor_item_t *easy_arr;
    arg_t *args;                            // List of args
    int nargs;                              // length of args array
    struct alloc_memory_list * cbor_item_list;

    // Deallocation control
    int refcount;
    pthread_mutex_t lock;

    long id;

} command_t;


command_t *command_rebuild(command_t *cmd);
command_t *command_new_using_cbor(const char *cmd, char *opt, char *cond, int condvec, char *actname, char *actid, char *actarg, cbor_item_t *arr, arg_t *args, int nargs);
command_t *command_new_using_arg(char *cmd, char *opt, char *cond, int condvec,
                    char *actname, char *actid, char *actarg, arg_t *args, int nargs);
command_t *command_new_using_arg_only(const char *cmd, char *opt, char *cond, int condvec, char *actname, char *actid, char *actarg,
                    arg_t *args, int nargs);
command_t *command_new(const char *cmd, char *opt, char *cond, int condvec, char *actname, char *actid, char *actarg, const char *fmt, ...);
rvalue_t *command_qargs_alloc(int remote, char *fmt, va_list args);
command_t *command_from_data(char *fmt, nvoid_t *data);

void command_hold(command_t *cmd);
void command_free(command_t *cmd);
void command_arg_print(arg_t *arg);
void command_print(command_t *cmd);

/*
 * Arg manipulation functions
 */
void command_arg_copy(arg_t *darg, arg_t *sarg);
arg_t *command_arg_clone(arg_t *arg);
void command_arg_free(arg_t *arg);
void command_arg_print(arg_t *arg);

#endif

#ifdef __cplusplus
}
#endif
