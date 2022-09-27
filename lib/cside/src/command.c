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

/*
 * Handles the JAM protocol .. uses CBOR for encoding and decoding data.
 * CBOR (RFC 7049 Concise Binary Object Representation). For more details go to
 * http://cbor.io
 */

#include <string.h>
#include <stdarg.h>
#include <stdio.h>
#include <pthread.h>
#include <tinycbor/cbor.h>
#include <stdlib.h>
#include "command.h"
#include <assert.h>


static long id = 1;

#define COPY_STRING(x, y, n)  do {       \
    if (y != NULL)                      \
        strncpy(x, y, n);               \
    else                                \
        strcpy(x, "");                  \
} while (0)

/*
 * Return a command that includes a CBOR representation that can be sent out (a byte string)
 * It reuses the command_new_using_arg() function
 */
command_t *command_new(int cmd, int subcmd, char *fn_name, long int task_id, char *node_id, char *fn_argsig, ...)
{
    va_list args;
    nvoid_t *nv;
    arg_t *qargs;
    int i = 0;
    char *fmt = fn_argsig;

    if (strlen(fmt) > 0)
        qargs = (arg_t *)calloc(strlen(fmt), sizeof(arg_t));
    else
        qargs = NULL;

    va_start(args, fn_argsig);
    while(*fmt) {
        switch(*fmt++) {
            case 'n':
                nv = va_arg(args, nvoid_t*);
                qargs[i].val.nval = nv;
                qargs[i].type = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char *));
                qargs[i].type = STRING_TYPE;
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type = INT_TYPE;
                break;
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type = DOUBLE_TYPE;
                break;
            default:
                break;
        }
        i++;
    }
    va_end(args);
    command_t *c = command_new_using_arg(cmd, subcmd, fn_name, task_id, node_id, fn_argsig, qargs, i);
    return c;
}



command_t *command_new_using_arg(int cmd, int subcmd, char *fn_name, long int taskid, char *node_id, char *fn_argsig, arg_t *args, int nargs)
{
    command_t *cmdo = (command_t *)calloc(1, sizeof(command_t));
    nvoid_t *nv;
    CborEncoder encoder, mapEncoder, arrayEncoder;
    cbor_encoder_init(&encoder, cmdo->buffer, HUGE_CMD_STR_LEN, 0);
    cbor_encoder_create_map(&encoder, &mapEncoder, 7);
    // store the fields into the structure and encode into the CBOR
    // store and encode cmd
    cmdo->cmd = cmd;
    cbor_encode_text_stringz(&mapEncoder, "cmd");
    cbor_encode_int(&mapEncoder, cmd);
    printf("Hi \n");
    // store and encode subcmd
    cmdo->cmd = subcmd;
    cbor_encode_text_stringz(&mapEncoder, "subcmd");
    cbor_encode_int(&mapEncoder, subcmd);
    // store and encode fn_name
    COPY_STRING(cmdo->fn_name, fn_name, SMALL_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "fn_name");
    cbor_encode_text_stringz(&mapEncoder, fn_name);
        printf("Hi \n");
    // store and encode task_id
    cmdo->task_id = taskid;
    cbor_encode_text_stringz(&mapEncoder, "taskid");
    cbor_encode_uint(&mapEncoder, taskid);
    // store and encode node_id
    COPY_STRING(cmdo->node_id, node_id, LARGE_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "nodeid");
    cbor_encode_text_stringz(&mapEncoder, node_id);
    // store and encode fn_argsig
        printf(">>>>>>>> . Hi %s\n", node_id);
    COPY_STRING(cmdo->fn_argsig, fn_argsig, SMALL_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "fn_argsig");
    cbor_encode_text_stringz(&mapEncoder, fn_argsig);
    // store and encode the args
    cmdo->args = args;
    cmdo->nargs = nargs;
    cbor_encode_text_stringz(&mapEncoder, "args");
    cbor_encoder_create_array(&mapEncoder, &arrayEncoder,nargs);
        printf("Hi \n");
    for (int i = 0; i < nargs; i++) {
        switch (args[i].type) {
            case NVOID_TYPE:
                nv = args[i].val.nval;
                cbor_encode_byte_string(&arrayEncoder, nv->data, nv->len);
                break;
            case STRING_TYPE:
                cbor_encode_text_stringz(&arrayEncoder, args[i].val.sval);
                break;
            case INT_TYPE:
                if (args[i].val.ival < 0)
                    cbor_encode_negative_int(&arrayEncoder, abs(args[i].val.ival));
                else
                    cbor_encode_int(&arrayEncoder, args[i].val.ival);
                break;
            case DOUBLE_TYPE:
                cbor_encode_double(&arrayEncoder, args[i].val.dval);
                break;
            case NULL_TYPE:
                cbor_encode_null(&arrayEncoder);
        }
    }
    cbor_encoder_close_container(&mapEncoder, &arrayEncoder);
    cbor_encoder_close_container(&encoder, &mapEncoder);
    cmdo->id = id++;
    cmdo->refcount = 1;
    pthread_mutex_init(&cmdo->lock, NULL);
    cmdo->length = cbor_encoder_get_buffer_size(&encoder, cmdo->buffer);
    return cmdo;
}


/*
 * Command from CBOR data. If the fmt is non NULL, then we use
 * the specification in fmt to validate the parameter ordering.
 * A local copy of bytes is actually created, so we can free it.
 */
command_t *command_from_data(char *fmt, void *data, int len)
{
    CborParser parser;
    CborValue it, map, value, key, arr;
    CborError err;
    size_t length;
    int i = 0;
    int ival;
    double dval;
    float fval;
    char bytebuf[LARGE_CMD_STR_LEN];
    char strbuf[LARGE_CMD_STR_LEN];
    char keybuf[32];
    int result;
    double dresult;
    int64_t uresult;

    command_t *cmd = (command_t *)calloc(1, sizeof(command_t));
    memcpy(cmd->buffer, data, len);
    cmd->length = len;
    cbor_parser_init(cmd->buffer, len, 0, &parser, &it);
    cbor_value_enter_container(&it, &map);
    while (!cbor_value_at_end(&map)) {
        //printf("First type %d\n", cbor_value_get_type(&map));
        if (cbor_value_get_type(&map) == CborTextStringType) {
            length = 32;
            cbor_value_copy_text_string	(&map, keybuf, &length, NULL);
        }
        cbor_value_advance(&map);
        printf("Second type %d\n, key %s==========", cbor_value_get_type(&map), keybuf);
        if (strcmp(keybuf, "cmd") == 0) {
            cbor_value_get_int(&map, &result);
            cmd->cmd = result;
        } else if (strcmp(keybuf, "subcmd") == 0) {
            cbor_value_get_int(&map, &result);
            cmd->subcmd = result;
        } else if (strcmp(keybuf, "taskid") == 0) {
            if (cbor_value_get_type(&map) == 251) {
                cbor_value_get_double(&map, &dresult);
                cmd->task_id = (uint64_t)dresult;
            } else {
                cbor_value_get_int(&map, &result);
                cmd->task_id = result;
            }
        } else if (strcmp(keybuf, "nodeid") == 0) {
            printf("Hi cond 2\n");
            length = LARGE_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map)) 
                cbor_value_copy_text_string	(&map, cmd->node_id, &length, NULL);
            else 
                strcpy(cmd->node_id, "");
         //   assert(length < LARGE_CMD_STR_LEN);
        } else if (strcmp(keybuf, "fn_name") == 0) {
            length = SMALL_CMD_STR_LEN;
            cbor_value_copy_text_string	(&map, cmd->fn_name, &length, NULL);
         //   assert(length < SMALL_CMD_STR_LEN);
        } else if (strcmp(keybuf, "fn_argsig") == 0) {
            length = SMALL_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string	(&map, cmd->fn_argsig, &length, NULL);
            else 
                strcpy(cmd->fn_argsig, "");
            printf("===================Fn argsig found ...%s, length %ld\n", cmd->fn_argsig, strlen(cmd->fn_argsig));
        //    assert(length < SMALL_CMD_STR_LEN);
        } else if (strcmp(keybuf, "args") == 0) {
            cbor_value_enter_container(&map, &arr);
            size_t nelems;
            cbor_value_get_array_length(&map, &nelems);
            if (nelems > 0) {
                cmd->nargs = nelems;
                cmd->args = (arg_t *)calloc(nelems, sizeof(arg_t));
                while (!cbor_value_at_end(&arr)) {
                    CborType ty = cbor_value_get_type(&arr);
                    cmd->args[i].nargs = cmd->nargs;
                    switch (ty) {
                        case CborIntegerType:
                            cmd->args[i].type = INT_TYPE;
                            cbor_value_get_int(&arr, &ival);
                            cmd->args[i].val.ival = ival;
                        break;
                        case CborTextStringType:
                            cmd->args[i].type = STRING_TYPE;
                            length = LARGE_CMD_STR_LEN;
                            cbor_value_copy_text_string(&arr, strbuf, &length, NULL);
                            cmd->args[i].val.sval = strdup(strbuf);
                        break;
                        case CborByteStringType:
                            cmd->args[i].type = NVOID_TYPE;
                            cbor_value_copy_text_string(&arr, bytebuf, &length, NULL);
                            cmd->args[i].val.nval = nvoid_new(bytebuf, length);
                        break;
                        case CborFloatType:
                            cmd->args[i].type = DOUBLE_TYPE;
                            cbor_value_get_float(&arr, &fval);
                            cmd->args[i].val.dval = fval;
                        case CborDoubleType:
                            cmd->args[i].type = DOUBLE_TYPE;
                            cbor_value_get_double(&arr, &dval);
                            cmd->args[i].val.dval = dval;
                        break;
                        default:
                        break;
                    }
                    i++;
                    err = cbor_value_advance(&arr);
                }
            } else {
                cmd->nargs = 0;
                cmd->args = NULL;
            }
        }
        cbor_value_advance(&map);
    }
    cmd->refcount = 1;
    pthread_mutex_init(&cmd->lock, NULL);
    cmd->id = id++;
    return cmd;
}


void command_hold(command_t *cmd)
{
    pthread_mutex_lock(&cmd->lock);
    cmd->refcount++;
    pthread_mutex_unlock(&cmd->lock);
}

void command_free(command_t *cmd)
{
    int rc;
    pthread_mutex_lock(&cmd->lock);
    rc = --cmd->refcount;
    pthread_mutex_unlock(&cmd->lock);

    // don't free the structure if some other thread could be referring to it.
    if (rc > 0)
        return;

    for(int i = 0; i < cmd->nargs && cmd->args != NULL; i++) {
        switch(cmd->args[i].type) {
            case STRING_TYPE: 
                free(cmd->args[i].val.sval);
                break;
            case NVOID_TYPE:
                if(cmd->args[i].val.nval != NULL)
                    nvoid_free(cmd->args[i].val.nval);
                    break;
            default: break;
        }
    }

    if (cmd->args != NULL) free(cmd->args);
    free(cmd);
}

bool command_qargs_alloc(const char *fmt, arg_t **rargs, va_list args)
{
    int i = 0;
    arg_t *qargs;
    nvoid_t *nv;
    int flen = strlen(fmt);

    if (flen > 0)
        qargs = (arg_t *)calloc(flen, sizeof(arg_t));
    else
        return false;

    while(*fmt) {
        switch(*fmt++) {
            case 'n':
                nv = va_arg(args, nvoid_t*);
                qargs[i].val.nval = nv;
                qargs[i].type = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char *));
                qargs[i].type = STRING_TYPE;
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type = INT_TYPE;
                break;
            case 'p':
                qargs[i].val.nval = va_arg(args, void *);
                qargs[i].type = VOID_TYPE;
                break;
            case 'd':
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type = DOUBLE_TYPE;
                break;
            default:
                break;
        }
        qargs[i].nargs = flen;
        i++;
    }

    *rargs = qargs;
    return true;
}

void command_arg_print(arg_t *arg)
{
    int i;
    for (i = 0; i < arg[0].nargs; i++) {
        switch(arg[i].type)
        {
            case INT_TYPE:
                printf("Int: %d ", arg[i].val.ival);
                break;
            case STRING_TYPE:
                printf("String: %s ", arg[i].val.sval);
                break;
            case DOUBLE_TYPE:
                printf("Double: %f ", arg[i].val.dval);
                break;
            default:
                break;
        }
    }
}

//empty the memory space pointer to by arg
void command_arg_inner_free(arg_t *arg)
{
    if (arg == NULL)
        return;
    for (int i = 0; i < arg[0].nargs; i++) {
        switch (arg[i].type)
        {
            case STRING_TYPE:
                free(arg[i].val.sval);
                break;
            case NVOID_TYPE:
                nvoid_free(arg[i].val.nval);
                break;
            default:
                break;
        }
    }
}

void command_arg_free(arg_t *arg) 
{
    if (arg != NULL) {
        command_arg_inner_free(arg);
        free(arg);
    }
}


arg_t *command_arg_clone(arg_t *arg)
{
    arg_t *val = (arg_t *)calloc(1, sizeof(arg_t));
    assert(val != NULL);
    if (arg == NULL)
    {
        printf("ERROR! Argument is NULL. Sender is putting argument values?\n");
        printf("Quitting\n");
        exit(1);
    }
    val->type = arg->type;
    val->nargs = 1;
    switch (arg->type)
    {
        case INT_TYPE:
            val->val.ival = arg->val.ival;
            return val;
        case DOUBLE_TYPE:
            val->val.dval = arg->val.dval;
            return val;
        case STRING_TYPE:
            val->val.sval = strdup(arg->val.sval);
            return val;
        case NVOID_TYPE:
            val->val.nval = nvoid_new(arg->val.nval->data, arg->val.nval->len);
            return val;
        case NULL_TYPE:
            val->val.ival = 0;
            return val;
    }
    return NULL;
}

void command_print(command_t *cmd)
{
    int i;

    printf("\n===================================\n");
    printf("\nCommand cmd: %d\n", cmd->cmd);
    printf("\nCommand subcmd: %d\n", cmd->subcmd);

    printf("\nCommand fn_name: %s\n", cmd->fn_name);
    printf("\nCommand taskid : %lu\n", cmd->task_id);
    printf("\nCommand node_id: %s\n", cmd->node_id);
    printf("\nCommand fn_argsig: %s\n", cmd->fn_argsig);

    printf("\nCommand buffer: ");
    for (i = 0; i < (int)strlen((char *)cmd->buffer); i++)
        printf("%x", (int)cmd->buffer[i]);
    printf("\nCommand number of args: %d\n", cmd->nargs);

    command_arg_print(cmd->args);
    
    printf("\n===================================\n");
}