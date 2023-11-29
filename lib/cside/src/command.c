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
#include <stdlib.h>
#include <assert.h>
#include <inttypes.h>
#include <tinycbor/cbor.h>
#include "command.h"
#include "dpanel.h"

static uint64_t id = 1;

#define COPY_STRING(x, y, n)  do {      \
    if (y != NULL)                      \
        strncpy(x, y, n);               \
    else                                \
        strcpy(x, "");                  \
} while (0)

internal_command_t* internal_command_new(command_t* cmd) {
    internal_command_t* icmd = (internal_command_t*)calloc(1, sizeof(internal_command_t));

    icmd->cmd = cmd->cmd;
    icmd->task_id = cmd->task_id;
    icmd->args = command_args_clone(cmd->args);
    return icmd;
}

void internal_command_free(internal_command_t* ic) {
    command_args_free(ic->args);
    free(ic);
}

/*
 * Return a command that includes a CBOR representation that can be sent out (a byte string)
 * It reuses the command_new_using_arg() function
 */
command_t* command_new(int cmd, int subcmd, char* fn_name, uint64_t task_id, char* node_id, char* old_id, char* fn_argsig, ...) {
    va_list args;
    arg_t* qargs = NULL;
    int len = strlen(fn_argsig);

    if (len > 0) {
        nvoid_t* nv;
        qargs = (arg_t*)calloc(len, sizeof(arg_t));

        va_start(args, fn_argsig);
        for (int i = 0; i < len; i++) {
            qargs[i].type = fn_argsig[i];
            switch(fn_argsig[i]) {
            case 'n':
            case 'C':
            case 'B':
            case 'I':
            case 'U':
            case 'L':
            case 'Z':
            case 'D':
            case 'F':
                nv = va_arg(args, nvoid_t*);
                qargs[i].val.nval = nvoid_dup(nv);
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char*));
                break;
            case 'c':
            case 'b':
            case 'i':
            case 'u':
                qargs[i].val.ival = va_arg(args, int);
                break;
            case 'l':
            case 'z':
                qargs[i].val.lval = va_arg(args, long long int);
                break;
            case 'd':
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                break;
            default:
                printf("Unrecognized type '%c' in command_new\n", fn_argsig[i]);
            }
            qargs[i].nargs = len;
        }
        va_end(args);
    }

    command_t* c = command_new_using_arg(cmd, subcmd, fn_name, task_id, node_id, old_id, fn_argsig, qargs);
    command_args_free(qargs);
    return c;
}

command_t* command_new_using_arg(int cmd, int subcmd, char* fn_name, uint64_t taskid, char* node_id, char* old_id, char* fn_argsig, arg_t* args) {
    command_t* cmdo = (command_t *)calloc(1, sizeof(command_t));
    CborEncoder encoder, mapEncoder, arrayEncoder;
    cbor_encoder_init(&encoder, cmdo->buffer, HUGE_CMD_STR_LEN, 0);
    cbor_encoder_create_map(&encoder, &mapEncoder, 8);
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
    cbor_encode_uint(&mapEncoder, taskid);
    // store and encode node_id
    COPY_STRING(cmdo->node_id, node_id, LARGE_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "nodeid");
    cbor_encode_text_stringz(&mapEncoder, node_id);
    // store and encode old_id
    COPY_STRING(cmdo->old_id, old_id, LARGE_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "oldid");
    cbor_encode_text_stringz(&mapEncoder, old_id);
    // store and encode fn_argsig
    COPY_STRING(cmdo->fn_argsig, fn_argsig, SMALL_CMD_STR_LEN);
    cbor_encode_text_stringz(&mapEncoder, "fn_argsig");
    cbor_encode_text_stringz(&mapEncoder, fn_argsig);
    // store and encode the args
    cbor_encode_text_stringz(&mapEncoder, "args");
    if (args == NULL) {
        cmdo->args = NULL;
        cbor_encoder_create_array(&mapEncoder, &arrayEncoder, 0);
    } else {
        cmdo->args = command_args_clone(args);
        cbor_encoder_create_array(&mapEncoder, &arrayEncoder, args[0].nargs);
        for (int i = 0; i < args[0].nargs; i++) {
            switch (args[i].type) {
            case 'c':
            case 'i':
                cbor_encode_int(&arrayEncoder, (int64_t)args[i].val.ival);
                break;
            case 'b':
            case 'u':
                cbor_encode_uint(&arrayEncoder, (uint64_t)(unsigned int)args[i].val.ival);
                break;
            case 'l':
                cbor_encode_int(&arrayEncoder, (int64_t)args[i].val.lval);
                break;
            case 'z':
                cbor_encode_uint(&arrayEncoder, (uint64_t)args[i].val.lval);
                break;
            case 'f':
            case 'd':
                cbor_encode_double(&arrayEncoder, args[i].val.lval);
                break;
            case 'C':
            case 'I':
            case 'B':
            case 'U':
            case 'L':
            case 'Z':
            case 'F':
            case 'D':
            case 'n':
                do_nvoid_encoding(&arrayEncoder, args[i].val.nval);
                break;
            case 's':
                cbor_encode_text_stringz(&arrayEncoder, args[i].val.sval);
                break;
            default:
                assert(false);
            }
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
 * the specification in fmt to validate the parameter ordering. (TODO: no, we don't)
 * A local copy of bytes is actually created, so we can free it.
 */
command_t* command_from_data(char* fmt, void* data, int len) {
    CborParser parser;
    CborValue it, map, arr;
    size_t length;
    int i = 0;
    int argsiglen = 0;
    float fval;
    char keybuf[32];
    uint64_t result;
    double dresult;

    // printf("command_from_data reading [%zu]", (size_t) len);
    // for (int i=0; i < len; i++)
    //     printf(" %.2x", i[(uint8_t*) data]);
    // putchar('\n');

    command_t* cmd = (command_t*)calloc(1, sizeof(command_t));
    //memcpy(cmd->buffer, data, len);
    cmd->length = len;
    cbor_parser_init(data, len, 0, &parser, &it);
    cbor_value_enter_container(&it, &map);
    while (!cbor_value_at_end(&map)) {
        if (cbor_value_get_type(&map) == CborTextStringType) {
            length = 32;
            cbor_value_copy_text_string	(&map, keybuf, &length, &map);
        } else {
            cbor_value_advance(&map);
            continue;
        }
        if (strcmp(keybuf, "cmd") == 0) {
            cbor_value_get_uint64(&map, &result);
            cmd->cmd = result;
        } else if (strcmp(keybuf, "subcmd") == 0) {
            cbor_value_get_uint64(&map, &result);
            cmd->subcmd = result;
        } else if (strcmp(keybuf, "taskid") == 0) {
            if (cbor_value_get_type(&map) == 251) {
                cbor_value_get_double(&map, &dresult);
                cmd->task_id = (uint64_t)dresult; // TODO we lose precision doing this
            } else {
                cbor_value_get_uint64(&map, &result);
                cmd->task_id = result;
            }
        } else if (strcmp(keybuf, "nodeid") == 0) {
            length = LARGE_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string	(&map, cmd->node_id, &length, NULL);
            else
                strcpy(cmd->node_id, "");
        } else if (strcmp(keybuf, "oldid") == 0) {
            length = LARGE_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map))
                cbor_value_copy_text_string	(&map, cmd->old_id, &length, NULL);
            else
                strcpy(cmd->old_id, "");
        } else if (strcmp(keybuf, "fn_name") == 0) {
            length = SMALL_CMD_STR_LEN;
            cbor_value_copy_text_string	(&map, cmd->fn_name, &length, NULL);
        } else if (strcmp(keybuf, "fn_argsig") == 0) {
            length = SMALL_CMD_STR_LEN;
            if (cbor_value_is_text_string(&map)) {
                cbor_value_copy_text_string	(&map, cmd->fn_argsig, &length, NULL);
                argsiglen = length;
            } else
                strcpy(cmd->fn_argsig, "");
        } else if (strcmp(keybuf, "args") == 0) {
            size_t nelems;
            assert(cbor_value_is_length_known(&map));
            cbor_value_get_array_length(&map, &nelems);
            // printf("%u; %s; %s; %zu\n", cmd->cmd, cmd->fn_name, cmd->fn_argsig, nelems);
            assert(nelems == argsiglen);

            cbor_value_enter_container(&map, &arr);

            if (nelems > 0) {
                if (fmt != NULL)
                    assert(!strcmp(fmt, cmd->fn_argsig));
                cmd->args = (arg_t*)calloc(nelems, sizeof(arg_t));

                while (!cbor_value_at_end(&arr)) {
                    CborType ty = cbor_value_get_type(&arr);
                    cmd->args[i].nargs = nelems;
                    char tmpcharbuf[2];
                    cmd->args[i].type = cmd->fn_argsig[i];
                    uint64_t tmp_uint;
                    switch (ty) {
                    case CborIntegerType:
                        switch(cmd->fn_argsig[i]) {
                        case 'c':
                        case 'b':
                        case 'i':
                            cbor_value_get_int(&arr, &cmd->args[i].val.ival);
                            break;
                        case 'u':
                            cbor_value_get_uint64(&arr, &tmp_uint);
                            *(unsigned int*)&cmd->args[i].val.ival = (unsigned int)tmp_uint;
                            break;
                        case 'l':
                            cbor_value_get_int64(&arr, (int64_t*)&cmd->args[i].val.lval);
                            break;
                        case 'z':
                            cbor_value_get_uint64(&arr, (uint64_t*)&cmd->args[i].val.lval);
                            break;
                        default:
                            assert(false);
                        }
                        break;
                    case CborTextStringType:
                        switch(cmd->fn_argsig[i]) {
                        case 's': // deprecated
                            cbor_value_dup_text_string(&arr, &cmd->args[i].val.sval, &length, NULL);
                            break;
                        case 'C':
                        case 'B':
                            cbor_value_calculate_string_length(&arr, &length);
                            cmd->args[i].val.nval = nvoid_empty(length++, cmd->fn_argsig[i]);
                            cbor_value_copy_text_string(&arr, (char*)cmd->args[i].val.nval->data, &length, NULL);
                            cmd->args[i].val.nval->len = length;
                            break;
                        case 'c':
                        case 'b':
                            cbor_value_calculate_string_length(&arr, &length);
                            assert(length == 1);
                            length++;
                            cbor_value_copy_text_string(&arr, tmpcharbuf, &length, NULL);
                            cmd->args[i].val.ival = (int)tmpcharbuf[0];
                            break;
                        default:
                            assert(false);
                        }
                        break;
                    case CborByteStringType:
                        switch(cmd->fn_argsig[i]) {
                        case 'C':
                        case 'B':
                            cbor_value_calculate_string_length(&arr, &length);
                            cmd->args[i].val.nval = nvoid_empty(length, cmd->fn_argsig[i]);
                            cbor_value_copy_byte_string(&arr, cmd->args[i].val.nval->data, &length, NULL);
                            cmd->args[i].val.nval->data[length] = '\0';
                            cmd->args[i].val.nval->len = length;
                            break;
                        case 'c':
                        case 'b':
                            cbor_value_calculate_string_length(&arr, &length);
                            assert(length == 1);
                            cbor_value_copy_byte_string(&arr, (uint8_t*)tmpcharbuf, &length, NULL);
                            cmd->args[i].val.ival = (int)tmpcharbuf[0];
                            break;
                        default:
                            assert(false);
                        }
                        break;
                    case CborFloatType:
                        assert(cmd->fn_argsig[i] == 'd' || cmd->fn_argsig[i] == 'f');
                        cbor_value_get_float(&arr, &fval);
                        cmd->args[i].val.dval = (double)fval;
                        break;
                    case CborDoubleType:
                        assert(cmd->fn_argsig[i] == 'd' || cmd->fn_argsig[i] == 'f');
                        cbor_value_get_double(&arr, &cmd->args[i].val.dval);
                        break;
                    case CborArrayType:
                        assert(cmd->fn_argsig[i] <= 'Z' && cmd->fn_argsig[i] >= 'A');
                        assert(cbor_value_is_length_known(&arr));
                        cbor_value_get_array_length(&arr, &length);
                        // printf("got array length %zu\n", length);
                        CborValue arrayEnc;
                        cbor_value_enter_container(&arr, &arrayEnc);
                        char type = cmd->fn_argsig[i] - 'A' + 'a';
                        nvoid_t* nval = nvoid_empty(length, type);
                        nval->len = length;
                        cmd->args[i].val.nval = nval;

                        for(int j = 0; j < nval->maxlen; j++) {
                            uint64_t tmp_uint;
                            int tmp_int;
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wcast-align" /* We specify __aligned__ (8) on nvoids */
                            switch(cbor_value_get_type(&arrayEnc)) {
                            case CborIntegerType:
                                switch(type) {
                                case 'c':
                                    cbor_value_get_int(&arrayEnc, &tmp_int);
                                    ((char*)nval->data)[j] = (char)tmp_int;
                                    break;
                                case 'b':
                                    cbor_value_get_uint64(&arr, &tmp_uint);
                                    ((unsigned char*)nval->data)[j] = (unsigned char)tmp_uint;
                                case 'i':
                                    cbor_value_get_int(&arrayEnc, &((int*)nval->data)[j]);
                                    break;
                                case 'u':
                                    cbor_value_get_uint64(&arrayEnc, &tmp_uint);
                                    ((unsigned int*)nval->data)[j] = (unsigned int)tmp_uint;
                                    break;
                                case 'l':
                                    cbor_value_get_int64(&arrayEnc, &((int64_t*)nval->data)[j]);
                                    break;
                                case 'z':
                                    cbor_value_get_uint64(&arrayEnc, &((uint64_t*)nval->data)[j]);
                                    break;
                                default:
                                    assert(false);
                                }
                                break;
                            case CborTextStringType:
                                cbor_value_calculate_string_length(&arrayEnc, &length);
                                assert(length == 1);
                                length++;
                                cbor_value_copy_text_string(&arrayEnc, tmpcharbuf, &length, NULL);
                                switch(type) {
                                case 'c':
                                case 'b':
                                    nval->data[j] = (uint8_t)tmpcharbuf[0];
                                    break;
                                case 'i':
                                case 'u':
                                    ((unsigned int*)nval->data)[j] = tmpcharbuf[0];
                                    break;
                                case 'l':
                                case 'z':
                                    ((uint64_t*)nval->data)[j] = tmpcharbuf[0];
                                    break;
                                default:
                                    assert(false);
                                }
                                break;
                            case CborByteStringType:
                                cbor_value_calculate_string_length(&arrayEnc, &length);
                                assert(length == 1);
                                cbor_value_copy_byte_string(&arrayEnc, (uint8_t*)tmpcharbuf, &length, NULL);
                                switch(type) {
                                case 'c':
                                case 'b':
                                    nval->data[j] = (uint8_t)tmpcharbuf[0];
                                    break;
                                case 'i':
                                case 'u':
                                    ((unsigned int*)nval->data)[j] = tmpcharbuf[0];
                                    break;
                                case 'l':
                                case 'z':
                                    ((uint64_t*)nval->data)[j] = tmpcharbuf[0];
                                    break;
                                default:
                                    assert(false);
                                }
                                break;
                            case CborFloatType:
                                if (type == 'd') {
                                    cbor_value_get_float(&arrayEnc, &fval);
                                    ((double*)nval->data)[j] = (double)fval;
                                } else if (type == 'f')
                                    cbor_value_get_float(&arrayEnc, &((float*)nval->data)[j]);
                                else
                                    assert(false);
                                break;
                            case CborDoubleType:
                                if (type == 'f') {
                                    double dval;
                                    cbor_value_get_double(&arrayEnc, &dval);
                                    ((float*)nval->data)[j] = (float)dval;
                                } else if (type == 'd')
                                    cbor_value_get_double(&arrayEnc, &((double*)nval->data)[j]);
                                else
                                    assert(false);
                                break;
                            default:
                                printf("CBOR illegal type: %d at %d\n", cbor_value_get_type(&arrayEnc), j);
                                assert(false);
                            }
#pragma GCC diagnostic push
                            cbor_value_advance(&arrayEnc);
                        }
                        i++;
                        cbor_value_leave_container(&arr, &arrayEnc);
                        continue;
                    default:
                        printf("Unrecognized CBOR %d command_from_data\n", ty);
                        assert(false);
                    }
                    i++;
                    cbor_value_advance(&arr);
                }

            } else
                cmd->args = NULL;
        }
        cbor_value_advance(&map);
    }
    cmd->refcount = 1;
    pthread_mutex_init(&cmd->lock, NULL);
    cmd->id = id++;
    return cmd;
}

void command_hold(command_t* cmd) {
    pthread_mutex_lock(&cmd->lock);
    cmd->refcount++;
    pthread_mutex_unlock(&cmd->lock);
}

void command_free(command_t* cmd) {
    int rc;
    pthread_mutex_lock(&cmd->lock);
    rc = --cmd->refcount;
    pthread_mutex_unlock(&cmd->lock);

    // don't free the structure if some other thread could be referring to it.
    if (rc > 0)
        return;

    command_args_free(cmd->args);
    free(cmd);
}

bool command_qargs_alloc(const char* fmt, arg_t** rargs, va_list args) {
    int flen = strlen(fmt);
    if (flen == 0)
        return false;

    arg_t* qargs = (arg_t*)calloc(flen, sizeof(arg_t));
    for (int i = 0; i < flen; i++) {
        qargs[i].type = fmt[i];
        switch(fmt[i]) {
        case 'n':
        case 'C':
        case 'B':
        case 'I':
        case 'U':
        case 'L':
        case 'Z':
        case 'D':
        case 'F':
            qargs[i].val.nval = nvoid_dup(va_arg(args, nvoid_t*));
            break;
        case 's':
            qargs[i].val.sval = strdup(va_arg(args, char*));
            break;
        case 'c':
        case 'b':
        case 'i':
        case 'u':
            qargs[i].val.ival = va_arg(args, int);
            break;
        case 'l':
        case 'z':
            qargs[i].val.lval = va_arg(args, long long int);
            break;
        case 'd':
        case 'f':
            qargs[i].val.dval = va_arg(args, double);
            break;
        default:
            printf("Unrecognized type '%c' in command_qargs_alloc\n", fmt[i]);
            assert(false);
        }
        qargs[i].nargs = flen;
    }

    *rargs = qargs;
    return true;
}

void command_arg_print(arg_t* arg)
{
    int i;
    for (i = 0; i < arg[0].nargs; i++) {
        switch(arg[i].type) {
        case 'c':
        case 'b':
        case 'i':
        case 'u':
            printf("Int: %d ", arg[i].val.ival);
            break;
        case 'l':
        case 'z':
            printf("Long Long Int: %lld ", arg[i].val.lval);
            break;
        case 's':
            printf("String: %s ", arg[i].val.sval);
            break;
        case 'f':
        case 'd':
            printf("Double: %f ", arg[i].val.dval);
            break;
        case 'n':
        case 'C':
        case 'B':
        case 'I':
        case 'U':
        case 'L':
        case 'Z':
        case 'F':
        case 'D':
            printf("Nvoid (%c): length %u ", (char)arg[i].val.nval->typefmt, arg[i].val.nval->len);
            break;
        default:
            printf("Other type: %d ", arg[i].type);
        }
    }
    fflush(stdout);
}

//empty the memory space pointer to by arg
void command_arg_inner_free(arg_t* arg) {
    if (arg == NULL)
        return;
    for (int i = 0; i < arg[0].nargs; i++) {
        switch (arg[i].type) {
        case 's':
            if(arg[i].val.sval)
                free(arg[i].val.sval);
            break;
        case 'n':
        case 'C':
        case 'B':
        case 'I':
        case 'U':
        case 'L':
        case 'Z':
        case 'F':
        case 'D':
            if(arg[i].val.nval)
                nvoid_free(arg[i].val.nval);
        }
    }
}

void command_args_free(arg_t* arg) {
    if (arg != NULL) {
        command_arg_inner_free(arg);
        free(arg);
    }
}

void command_args_copy_elements(arg_t* arg_from, arg_t* arg_to, size_t nargs_from, size_t nargs_to)
{
    assert(nargs_from <= nargs_to);
    assert(arg_from != NULL);
    assert(arg_to != NULL);

    for (int i = 0; i < nargs_from; i++) {
        arg_to[i].type = arg_from[i].type;
        arg_to[i].nargs = nargs_to;
        switch (arg_from[i].type) {
        case 'c':
        case 'b':
        case 'i':
        case 'u':
            arg_to[i].val.ival = arg_from[i].val.ival;
            break;
        case 'l':
        case 'z':
            arg_to[i].val.lval = arg_from[i].val.lval;
            break;
        case 'd':
        case 'f':
            arg_to[i].val.dval = arg_from[i].val.dval;
            break;
        case 's':
            arg_to[i].val.sval = strdup(arg_from[i].val.sval);
            break;
        case 'n':
        case 'C':
        case 'B':
        case 'I':
        case 'U':
        case 'L':
        case 'Z':
        case 'F':
        case 'D':
            arg_to[i].val.nval = nvoid_dup(arg_from[i].val.nval);
            break;
        default:
            printf("Unknown type %d in command_args_copy_elements\n", arg_from[i].type);
            assert(false);
        }
    }
}

arg_t* command_args_clone(arg_t* arg) {
    arg_t* val = (arg_t*)calloc(arg[0].nargs, sizeof(arg_t));
    assert(val != NULL);

    command_args_copy_elements(arg, val, arg[0].nargs, arg[0].nargs);

    return val;
}

void command_print(command_t* cmd) {
    printf("\n===================================\n");
    printf("\nCommand cmd: %d\n", cmd->cmd);
    printf("\nCommand subcmd: %d\n", cmd->subcmd);

    printf("\nCommand fn_name: %s\n", cmd->fn_name);
    printf("\nCommand taskid : %" PRIu64 "\n", cmd->task_id);
    printf("\nCommand node_id: %s\n", cmd->node_id);
    printf("\nCommand old_id: %s\n", cmd->old_id);
    printf("\nCommand fn_argsig: %s\n", cmd->fn_argsig);

    printf("\nCommand buffer [%d]: ", cmd->length);
    for (int i=0; i < cmd->length; i++)
        printf(" %.2x", i[(uint8_t*) cmd->buffer]);
    putchar('\n');


    command_arg_print(cmd->args);
    printf("\n===================================\n");
}
