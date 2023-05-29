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

#include "command.h"

#include <assert.h>
#include <cbor.h>

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static long id = 1;

#define COPY_STRING(x, y, n)                                                   \
    do                                                                         \
    {                                                                          \
        if (y != NULL)                                                         \
            strncpy(x, y, n-1);                                                  \
        else                                                                   \
            strcpy(x, "");                                                     \
    } while (0)

internal_command_t* internal_command_new(command_t* cmd)
{
    internal_command_t* icmd = (internal_command_t*)calloc(
        1, sizeof(internal_command_t));

    icmd->cmd     = cmd->cmd;
    icmd->task_id = cmd->task_id;
    icmd->args    = command_args_clone(cmd->args);
    return icmd;
}

void internal_command_free(internal_command_t* ic)
{
    command_args_free(ic->args);
    free(ic);
}

/*
 * Return a command that includes a CBOR representation that can be sent out (a
 * byte string) It reuses the command_new_using_arg() function
 */
command_t* command_new(int cmd, int subcmd, const char* fn_name, uint64_t task_id,
                       const char* node_id, const char* fn_argsig, ...)
{
    va_list args;
    nvoid_t* nv;
    arg_t* qargs;
    int len = strlen(fn_argsig);

    if (len > 0)
    {
        qargs = (arg_t*)calloc(len, sizeof(arg_t));

        va_start(args, fn_argsig);
        for (int i = 0; i < len; i++)
        {
            switch (fn_argsig[i])
            {
            case 'n':
                nv                = va_arg(args, nvoid_t*);
                qargs[i].val.nval = nv;
                qargs[i].type     = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char*));
                qargs[i].type     = STRING_TYPE;
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type     = INT_TYPE;
                break;
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type     = DOUBLE_TYPE;
                break;
            default:
                break;
            }
            qargs[i].nargs = len;
        }
        va_end(args);
    }
    else
        qargs = NULL;

    command_t* c = command_new_using_arg(cmd, subcmd, fn_name, 
                                         task_id, node_id, fn_argsig, 
                                         qargs);

    if(qargs!=NULL)
        command_args_free(qargs);
    return c;
}

command_t* command_new_using_arg(int cmd, int subcmd, const char* fn_name,
                                 uint64_t taskid, const char* node_id,
                                 const char* fn_argsig, arg_t* args)
{
    command_t* cmdo = (command_t*)calloc(1, sizeof(command_t));
    
    nvoid_t* nv;

    CborEncoder encoder, mapEncoder, arrayEncoder;
    cbor_encoder_init(&encoder, cmdo->buffer, HUGE_CMD_STR_LEN, 0);
    cbor_encoder_create_map(&encoder, &mapEncoder, 7);

    // store the fields into the structure and encode into the CBOR
    // store and encode cmd
    cmdo->cmd = cmd;
    cbor_encode_text_stringz(&mapEncoder, "cmd");
    cbor_encode_int(&mapEncoder, cmd);

    // store and encode subcmd
    cmdo->subcmd = subcmd;
    cbor_encode_text_stringz(&mapEncoder, "subcmd");
    cbor_encode_int(&mapEncoder, subcmd);

    // store and encode fn_name
    COPY_STRING(cmdo->fn_name, fn_name, SMALL_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "fn_name");
    cbor_encode_text_stringz(&mapEncoder, fn_name);

    // store and encode task_id
    cmdo->task_id = taskid;
    cbor_encode_text_stringz(&mapEncoder, "taskid");
    //cbor_encode_uint(&mapEncoder, taskid);
    cbor_encode_double(&mapEncoder, taskid);

    // store and encode node_id
    COPY_STRING(cmdo->node_id, node_id, LARGE_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "nodeid");
    cbor_encode_text_stringz(&mapEncoder, node_id);

    // store and encode fn_argsig
    COPY_STRING(cmdo->fn_argsig, fn_argsig, SMALL_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "fn_argsig");
    cbor_encode_text_stringz(&mapEncoder, fn_argsig);
	
    // store and encode the args
    cbor_encode_text_stringz(&mapEncoder, "args");
    if (args == NULL)
    {
        cmdo->args = NULL;
        cbor_encoder_create_array(&mapEncoder, &arrayEncoder, 0);
    }
    else
    {
        cmdo->args = command_args_clone(args);
        cbor_encoder_create_array(&mapEncoder, &arrayEncoder, args[0].nargs);
        for (int i = 0; i < args[0].nargs; i++)
        {
            switch (args[i].type)
            {
            case NVOID_TYPE:
                nv = args[i].val.nval;
                cbor_encode_byte_string(&arrayEncoder, nv->data, nv->len);
                break;
            case STRING_TYPE:
                cbor_encode_text_stringz(&arrayEncoder, args[i].val.sval);
                break;
            case INT_TYPE:
            case LONG_TYPE:
                if (args[i].val.ival < 0)
                    cbor_encode_negative_int(
                        &arrayEncoder, abs(args[i].val.ival));
                else
                    cbor_encode_int(&arrayEncoder, args[i].val.ival);
                break;
            case DOUBLE_TYPE:
                cbor_encode_double(&arrayEncoder, args[i].val.dval);
                break;
            case NULL_TYPE:
                cbor_encode_null(&arrayEncoder);
            default:;
            }
        }
    }
    cbor_encoder_close_container(&mapEncoder, &arrayEncoder);
    cbor_encoder_close_container(&encoder, &mapEncoder);
    cmdo->id       = id++;
    cmdo->refcount = 1;
    
    cmdo->length = cbor_encoder_get_buffer_size(&encoder, cmdo->buffer);

    return cmdo;
}

/*
 * Command from CBOR data. If the fmt is non NULL, then we use
 * the specification in fmt to validate the parameter ordering.
 * A local copy of bytes is actually created, so we can free it.
 */
command_t* command_from_data(char* fmt, void* data, int len)
{
    CborParser parser;
    CborValue it, map, arr;
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

    command_t* cmd = (command_t*)calloc(1, sizeof(command_t));
    memcpy(cmd->buffer, data, len);
    cmd->length = len;
    cbor_parser_init(cmd->buffer, len, 0, &parser, &it);
    cbor_value_enter_container(&it, &map);
    while (!cbor_value_at_end(&map))
    {
        if (cbor_value_get_type(&map) == CborTextStringType)
        {
            length = 32;
            cbor_value_copy_text_string(&map, keybuf, &length, NULL);
        }
        cbor_value_advance(&map);
        if (strcmp(keybuf, "cmd") == 0)
        {
            cbor_value_get_int(&map, &result);
            cmd->cmd = result;
        }
        else if (strcmp(keybuf, "subcmd") == 0)
        {
            cbor_value_get_int(&map, &result);
            cmd->subcmd = result;
        }
        else if (strcmp(keybuf, "taskid") == 0)
        {
            if (cbor_value_get_type(&map) == 251)
            {
                cbor_value_get_double(&map, &dresult);
                cmd->task_id = (uint64_t)dresult;
            }
            else
            {
                cbor_value_get_int(&map, &result);
                cmd->task_id = result;
            }
        }
        else if (strcmp(keybuf, "nodeid") == 0)
        {
            length = LARGE_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string(&map, cmd->node_id, &length, NULL);
            else
                strcpy(cmd->node_id, "");
        }
        else if (strcmp(keybuf, "fn_name") == 0)
        {
            length = SMALL_CMD_STR_LEN;
            cbor_value_copy_text_string(&map, cmd->fn_name, &length, NULL);
        }
        else if (strcmp(keybuf, "fn_argsig") == 0)
        {
            length = SMALL_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string(
                    &map, cmd->fn_argsig, &length, NULL);
            else
                strcpy(cmd->fn_argsig, "");
        }
        else if (strcmp(keybuf, "args") == 0)
        {
            cbor_value_enter_container(&map, &arr);
            size_t nelems = 0;
            cbor_value_get_array_length(&map, &nelems);
            if (nelems > 0)
            {
                cmd->args = (arg_t*)calloc(nelems, sizeof(arg_t));
                while (!cbor_value_at_end(&arr))
                {
                    CborType ty        = cbor_value_get_type(&arr);
                    cmd->args[i].nargs = nelems;
                    switch (ty)
                    {
                    case CborIntegerType:
                        cmd->args[i].type = INT_TYPE;
                        cbor_value_get_int(&arr, &ival);
                        cmd->args[i].val.ival = ival;
                        break;
                    case CborTextStringType:
                        cmd->args[i].type = STRING_TYPE;
                        length            = LARGE_CMD_STR_LEN;
                        cbor_value_copy_text_string(
                            &arr, strbuf, &length, NULL);
                        cmd->args[i].val.sval = strdup(strbuf);
                        break;
                    case CborByteStringType:
                        cmd->args[i].type = NVOID_TYPE;
                        cbor_value_copy_text_string(
                            &arr, bytebuf, &length, NULL);
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
            }
            else
                cmd->args = NULL;
        }
        cbor_value_advance(&map);
    }
    cmd->refcount = 1;
    cmd->id = id++;
    return cmd;
}

void command_from_data_inplace(command_t* cmd, const char* fn_argsig, int len)
{
    CborParser parser;
    CborValue it, map, arr;
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

    cmd->length = len;
    cbor_parser_init(cmd->buffer, len, 0, &parser, &it);
    cbor_value_enter_container(&it, &map);
    while (!cbor_value_at_end(&map))
    {
        if (cbor_value_get_type(&map) == CborTextStringType)
        {
            length = 32;
            cbor_value_copy_text_string(&map, keybuf, &length, NULL);
        }
        cbor_value_advance(&map);
        if (strcmp(keybuf, "cmd") == 0)
        {
            cbor_value_get_int(&map, &result);
            cmd->cmd = result;
        }
        else if (strcmp(keybuf, "subcmd") == 0)
        {
            cbor_value_get_int(&map, &result);
            cmd->subcmd = result;
        }
        else if (strcmp(keybuf, "taskid") == 0)
        {
            if (cbor_value_get_type(&map) == 251)
            {
                cbor_value_get_double(&map, &dresult);
                cmd->task_id = (uint64_t)dresult;
            }
            else
            {
                cbor_value_get_int(&map, &result);
                cmd->task_id = result;
            }
        }
        else if (strcmp(keybuf, "nodeid") == 0)
        {
            length = LARGE_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string(&map, cmd->node_id, &length, NULL);
            else
                strcpy(cmd->node_id, "");
        }
        else if (strcmp(keybuf, "fn_name") == 0)
        {
            length = SMALL_CMD_STR_LEN;
            cbor_value_copy_text_string(&map, cmd->fn_name, &length, NULL);
        }
        else if (strcmp(keybuf, "fn_argsig") == 0)
        {
            length = SMALL_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string(
                    &map, cmd->fn_argsig, &length, NULL);
            else
                strcpy(cmd->fn_argsig, "");
        }
        else if (strcmp(keybuf, "args") == 0)
        {
            cbor_value_enter_container(&map, &arr);
            size_t nelems = 0;
            cbor_value_get_array_length(&map, &nelems);
            if (nelems > 0)
            {
                cmd->args = (arg_t*)calloc(nelems, sizeof(arg_t));
                while (!cbor_value_at_end(&arr))
                {
                    CborType ty        = cbor_value_get_type(&arr);
                    cmd->args[i].nargs = nelems;
                    switch (ty)
                    {
                    case CborIntegerType:
                        cmd->args[i].type = INT_TYPE;
                        cbor_value_get_int(&arr, &ival);
                        cmd->args[i].val.ival = ival;
                        break;
                    case CborTextStringType:
                        cmd->args[i].type = STRING_TYPE;
                        length            = LARGE_CMD_STR_LEN;
                        cbor_value_copy_text_string(
                            &arr, strbuf, &length, NULL);
                        cmd->args[i].val.sval = strdup(strbuf);
                        break;
                    case CborByteStringType:
                        cmd->args[i].type = NVOID_TYPE;
                        cbor_value_copy_text_string(
                            &arr, bytebuf, &length, NULL);
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
            }
            else
                cmd->args = NULL;
        }
        cbor_value_advance(&map);
    }
    cmd->refcount = 1;
    cmd->id = id++;
}

void command_hold(command_t* cmd)
{
    cmd->refcount++;
}

void command_free(command_t* cmd)
{
    int nargs;
    int rc;
    rc = --cmd->refcount;

    // don't free the structure if some other thread could be referring to it.
    if (rc > 0)
        return;

    nargs = cmd->args != NULL ? cmd->args[0].nargs : 0;
    for (int i = 0; i < nargs; i++)
    {
        switch (cmd->args[i].type)
        {
        case STRING_TYPE:
            free(cmd->args[i].val.sval);
            break;
        case NVOID_TYPE:
            if (cmd->args[i].val.nval != NULL)
                nvoid_free(cmd->args[i].val.nval);
            break;
        default:
            break;
        }
    }

    if (cmd->args != NULL)
        free(cmd->args);
    free(cmd);
}

bool command_qargs_alloc(const char* fmt, arg_t** rargs, va_list args)
{
    arg_t* qargs = NULL;
    nvoid_t* nv;
    int flen = strlen(fmt);

    if (flen > 0)
    {
        qargs = (arg_t*)calloc(flen, sizeof(arg_t));
    }
    else
        return false;

    for (int i = 0; i < flen; i++)
    {
        switch (fmt[i])
        {
        case 'n':
            nv                = va_arg(args, nvoid_t*);
            qargs[i].val.nval = nv;
            qargs[i].type     = NVOID_TYPE;
            break;
        case 's':
            qargs[i].val.sval = strdup(va_arg(args, char*));
            qargs[i].type     = STRING_TYPE;
            break;
        case 'i':
            qargs[i].val.ival = va_arg(args, int);
            qargs[i].type     = INT_TYPE;
            break;
        case 'p':
            qargs[i].val.nval = va_arg(args, void*);
            qargs[i].type     = VOID_TYPE;
            break;
        case 'd':
        case 'f':
            qargs[i].val.dval = va_arg(args, double);
            qargs[i].type     = DOUBLE_TYPE;
            break;
        default:
            break;
        }
        qargs[i].nargs = flen;
    }

    *rargs = qargs;
    return true;
}

void command_arg_print(arg_t* arg)
{
    int i;
    for (i = 0; i < arg[0].nargs; i++)
    {
        switch (arg[i].type)
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

// empty the memory space pointer to by arg
void command_arg_inner_free(arg_t* arg)
{
    if (arg == NULL)
        return;
    for (int i = 0; i < arg[0].nargs; i++)
    {
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

void command_args_free(arg_t* arg)
{
    if (arg != NULL)
    {
        command_arg_inner_free(arg);
        free(arg);
    }
}

arg_t* command_args_clone(arg_t* arg)
{
    if(arg==NULL)
        return NULL;
    arg_t* val = (arg_t*)calloc(arg[0].nargs, sizeof(arg_t));
    assert(val != NULL);
    for (int i = 0; i < arg[0].nargs; i++)
    {
        val[i].type  = arg[i].type;
        val[i].nargs = arg[i].nargs;
        switch (arg[i].type)
        {
        case INT_TYPE:
        case LONG_TYPE:
            val[i].val.ival = arg[i].val.ival;
            break;
        case DOUBLE_TYPE:
            val[i].val.dval = arg[i].val.dval;
            break;
        case STRING_TYPE:
            val[i].val.sval = strdup(arg[i].val.sval);
            break;
        case NVOID_TYPE:
            val[i].val.nval = nvoid_new(
                arg[i].val.nval->data, arg[i].val.nval->len);
            break;
        case NULL_TYPE:
            val[i].val.ival = 0;
            break;
        default:;
        }
    }
    return val;
}

void command_print(command_t* cmd)
{
    int i;

    printf("\n===================================\n");
    printf("\nCommand cmd: %d\n", cmd->cmd);
    printf("\nCommand subcmd: %d\n", cmd->subcmd);

    printf("\nCommand fn_name: %s\n", cmd->fn_name);
    printf("\nCommand taskid : %llu\n", cmd->task_id);
    printf("\nCommand node_id: %s\n", cmd->node_id);
    printf("\nCommand fn_argsig: %s\n", cmd->fn_argsig);

    printf("\nCommand buffer: ");
    for (i = 0; i < (int)strlen((char*)cmd->buffer); i++)
        printf("%x", (int)cmd->buffer[i]);

    command_arg_print(cmd->args);

    printf("\n===================================\n");
}