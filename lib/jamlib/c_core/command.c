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

#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdio.h>

#include <cbor.h>

#include "command.h"

/*
 * Return a command in CBOR format (as an unsigned char array) that can be sent out..
 *
 * The format is a 3-member object:
 *         cmd: command name: RPC, PING, REGISTER, etc (see command.txt for a
 *              full list of commands)
 *         actid: 64 bit integer ID of the activity - 0 if not activity
  *         args: array of arguments to the command
 *
 * Limitations: We have limitations in the types of arguments that can be encoded.
 * At this time, they should all be primary types.
 *
 * format - s (string), i (integer) f,d for float/double - no % (e.g., "si")
 *
 */
command_t *command_new_using_cbor(const char *cmd, char *opt, char *actname, char *actid,
                                cbor_item_t *arr, arg_t *args, int nargs)
{

    // Allocate a new command structure.. we are going to save the cbor
    // version in the command structure. Not much of the command is used
    command_t *cmdo = (command_t *) calloc(1, sizeof(command_t));

    // hookup parameter such as cmd, opt, actname, etc
    cmdo->cmd = strdup(cmd);
    cmdo->opt = strdup(opt);
    cmdo->actname = strdup(actname);
    cmdo->actid = strdup(actid);

    cmdo->args = args;
    cmdo->nargs = nargs;

    /*
     * Format of the CBOR map is as follows in equivalent JSON syntax
     * {cmd: Command_String, actid: Activity ID, args: [Array of args]}
     */


    cbor_item_t *rmap = cbor_new_definite_map(5);

    // Add the cmd field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("cmd")),
        .value = cbor_move(cbor_build_string(cmd))
    });

    // Add the opt field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("opt")),
        .value = cbor_move(cbor_build_string(opt))
    });

    // Add the actname field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("actname")),
        .value = cbor_move(cbor_build_string(actname))
    });

    // Add the actid field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("actid")),
        .value = cbor_move(cbor_build_string(actid))
    });

    // Add the args field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("args")),
        .value = cbor_move(arr)
    });

    cmdo->cdata = rmap;

    cbor_serialize_alloc(rmap, &(cmdo->buffer), (size_t *)&(cmdo->length));
    return cmdo;
}


/*
 * Return a command in CBOR format (as an unsigned char array) that can be sent out..
 *
 * Reusing the previous command encoder..
 *
 */
command_t *command_new(const char *cmd, char *opt, char *actname, char *actid, const char *fmt, ...)
{
    va_list args;
    nvoid_t *nv;
    int i = 0;
    arg_t *qargs = (arg_t *)calloc(strlen(fmt), sizeof(arg_t));

    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *elem;

    va_start(args, fmt);

    while(*fmt)
    {
        switch(*fmt++)
        {
            case 'n':
                nv = va_arg(args, nvoid_t*);
                elem = cbor_build_bytestring(nv->data, nv->len);
                qargs[i].val.nval = nv;
                qargs[i].type = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char *));
                qargs[i].type = STRING_TYPE;
                elem = cbor_build_string(qargs[i].val.sval);
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type = INT_TYPE;
                elem = cbor_build_uint32(abs(qargs[i].val.ival));
                if (qargs[i].val.ival < 0)
                    cbor_mark_negint(elem);
                break;
            case 'd':
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type = DOUBLE_TYPE;
                elem = cbor_build_float8(qargs[i].val.dval);
                break;
            default:
                break;
        }
        i++;
        if (elem)
            assert(cbor_array_push(arr, elem) == true);
    }

    va_end(args);

    command_t *c = command_new_using_cbor(cmd, opt, actname, actid, arr, qargs, i);
//    command_print(c);
    return c;
}



/*
 * Command from CBOR data. If the fmt is non NULL, then we use
 * the specification in fmt to validate the parameter ordering.
 * A local copy of bytes is actually created, so we can free it.
 */

command_t *command_from_data(char *fmt, nvoid_t *data)
{
    int i;
    char fieldname[64];
    struct cbor_load_result result;

    command_t *cmd = (command_t *)calloc(1, sizeof(command_t));
    cmd->buffer = (unsigned char *)malloc(data->len);
    memcpy(cmd->buffer, data->data, data->len);
    cmd->cdata = cbor_load(cmd->buffer, data->len, &result);
    cmd->length = data->len;

    // extract information from the CBOR object and validate or fill the
    // command structure

    // check the size of the CBOR map
    int items = cbor_map_size(cmd->cdata);
    assert(items == 5);

    printf("1 \n");

    struct cbor_pair *mitems = cbor_map_handle(cmd->cdata);

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[0].key),
                        (int)cbor_string_length(mitems[0].key));
    fieldname[(int)cbor_string_length(mitems[0].key)] = 0;
    assert(strcmp(fieldname, "cmd") == 0);

    printf("2 \n");
    cmd->cmd = calloc((int)cbor_string_length(mitems[0].value) +1, sizeof(char));
    strncpy(cmd->cmd, (char *)cbor_string_handle(mitems[0].value),
                        (int)cbor_string_length(mitems[0].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[1].key),
                        (int)cbor_string_length(mitems[1].key));
    fieldname[(int)cbor_string_length(mitems[1].key)] = 0;
    assert(strcmp(fieldname, "opt") == 0);

    printf("3 \n");

    cmd->opt = calloc((int)cbor_string_length(mitems[1].value) +1, sizeof(char));
    strncpy(cmd->opt, (char *)cbor_string_handle(mitems[1].value),
                        (int)cbor_string_length(mitems[1].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[2].key),
                        (int)cbor_string_length(mitems[2].key));
    fieldname[(int)cbor_string_length(mitems[2].key)] = 0;
    assert(strcmp(fieldname, "actname") == 0);

    printf("4 \n");

    cmd->actname = calloc((int)cbor_string_length(mitems[2].value) +1, sizeof(char));
    strncpy(cmd->actname, (char *)cbor_string_handle(mitems[2].value),
                        (int)cbor_string_length(mitems[2].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[3].key),
                        (int)cbor_string_length(mitems[3].key));
    fieldname[(int)cbor_string_length(mitems[3].key)] = 0;
    assert(strcmp(fieldname, "actid") == 0);

    printf("5 \n");

    cmd->actid = calloc((int)cbor_string_length(mitems[3].value) +1, sizeof(char));
    strncpy(cmd->actid, (char *)cbor_string_handle(mitems[3].value),
                        (int)cbor_string_length(mitems[3].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[4].key),
                        (int)cbor_string_length(mitems[4].key));
    printf("6 \n");
    fieldname[(int)cbor_string_length(mitems[4].key)] = 0;
    assert(strcmp(fieldname, "args") == 0);

    cbor_item_t *arr = mitems[4].value;
    cmd->nargs = cbor_array_size(arr);
    cmd->args = (arg_t *)calloc(cmd->nargs, sizeof(arg_t));

    printf("6 cmd-length %d, nargs %d\n", cmd->length, cmd->nargs);

    if (fmt != NULL && strlen(fmt) != cmd->nargs) {
        printf("ERROR! Message does not match the validation specification\n");
        return NULL;
    }
    cbor_item_t **arrl = cbor_array_handle(arr);
    // parse the array of args and fill in the local command structure..
    for (i = 0; i < cmd->nargs; i++) {
        printf("Processing arg \n");
        switch (cbor_typeof(arrl[i])) {
            case CBOR_TYPE_UINT:
                printf("Int \n");
                if (fmt != NULL && fmt[i] != 'i') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = INT_TYPE;
                cmd->args[i].val.ival = cbor_get_uint32(arrl[i]);
                break;

            case CBOR_TYPE_NEGINT:
                printf("Neg. Int \n");
                if (fmt != NULL && fmt[i] != 'i') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = INT_TYPE;
                cmd->args[i].val.ival = -1 * cbor_get_uint32(arrl[i]);
                break;

            case CBOR_TYPE_STRING:
                printf("String \n");
                if (fmt != NULL && fmt[i] != 's') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                char *str = (char *)malloc(cbor_string_length(arrl[i]));
                strncpy(str, (const char *)cbor_string_handle(arrl[i]),
                                    (int)cbor_string_length(arrl[i]));
                cmd->args[i].type = STRING_TYPE;
                printf("============ String %s, len %d\n", str, (int)cbor_string_length(arrl[i]));
                cmd->args[i].val.sval = str;
                break;

            case CBOR_TYPE_FLOAT_CTRL:
                printf("Float \n");
                if (fmt != NULL && fmt[i] != 'd') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = DOUBLE_TYPE;
                cmd->args[i].val.dval = cbor_float_get_float8(arrl[i]);
                break;
            case CBOR_TYPE_BYTESTRING:
                printf("Bytestring. \n");
                if (fmt != NULL && fmt[i] != 'n') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = NVOID_TYPE;
                cmd->args[i].val.nval = nvoid_new(cbor_bytestring_handle(arrl[i]), cbor_bytestring_length(arrl[i]));
                break;
            default:
                // Nothing to do for the CBOR types - at least for now
                break;
        }

    }

    return cmd;
}


void command_free(command_t *cmd)
{
    // free the field allocations
    free(cmd->cmd);
    free(cmd->opt);
    free(cmd->actname);

    free(cmd->actid);

    // decrement the reference to the CBOR object..
    if (cmd->cdata)
        cbor_decref(&cmd->cdata);
    free(cmd->args);
    free(cmd);
}


void command_print_arg(arg_t *arg)
{
    printf("\t\t");
    switch(arg->type) {
        case INT_TYPE:
            printf("Int: %d ", arg->val.ival);
            break;
        case STRING_TYPE:
            printf("String: %s ", arg->val.sval);
            break;
        case DOUBLE_TYPE:
            printf("Double: %f ", arg->val.dval);
            break;
        default:
            break;
    }
}



// Print the command object..
//
void command_print(command_t *cmd)
{
    int i;

    printf("\n===================================\n");
    printf("\nCommand cmd: %s\n", cmd->cmd);
    printf("\nCommand opt: %s\n", cmd->opt);
    printf("\nCommand activity name: %s\n", cmd->actname);
    printf("\nCommand activity id: %s\n", cmd->actid);    

    printf("\nCommand buffer: ");
    for (i = 0; i < strlen((char *)cmd->buffer); i++)
        printf("%x", (int)cmd->buffer[i]);
    printf("\nCommand number of args: %d\n", cmd->nargs);

    for (i = 0; i < cmd->nargs; i++)
        command_print_arg(&cmd->args[i]);

    printf("\n");

    cbor_describe(cmd->cdata, stdout);
    printf("\n===================================\n");
}
