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
command_t *command_new_using_cbor(const char *cmd, char *opt, char *actname, uint64_t actid, cbor_item_t *arr)
{

    // Allocate a new command structure.. we are going to save the cbor
    // version in the command structure. Not much of the command is used
    command_t *cmdo = (command_t *) calloc(1, sizeof(command_t));

    /*
     * Format of the CBOR map is as follows in equivalent JSON syntax
     * {cmd: Command_String, actid: Activity ID, args: [Array of args]}
     */


    cbor_item_t *rmap = cbor_new_definite_map(4);

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
        .value = cbor_move(cbor_build_uint64(actid))
    });

    // Add the args field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("args")),
        .value = cbor_move(arr)
    });

    cbor_serialize_alloc(rmap, &(cmdo->buffer), (size_t *)&(cmdo->length));
    return cmdo;
}


/*
 * Return a command in CBOR format (as an unsigned char array) that can be sent out..
 *
 * Reusing the previous command encoder..
 *
 */
command_t *command_new(const char *cmd, char *opt, char *actname, uint64_t actid, const char *fmt, ...)
{
    va_list args;
    int val;
    nvoid_t *nv;

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
                break;
            case 's':
                elem = cbor_build_string(va_arg(args, char *));
                break;
            case 'i':
                val = va_arg(args, int);
                elem = cbor_build_uint32(abs(val));
                if (val < 0)
                    cbor_mark_negint(elem);
                break;
            case 'd':
            case 'f':
                elem = cbor_build_float8(va_arg(args, double));
                break;
            default:
                break;
        }
        if (elem)
            assert(cbor_array_push(arr, elem) == true);
    }

    va_end(args);

    return command_new_using_cbor(cmd, opt, actname, actid, arr);
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
    cmd->item = cbor_load(cmd->buffer, data->len, &result);
    cmd->length = data->len;

    // extract information from the CBOR object and validate or fill the
    // command structure

    // check the size of the CBOR map
    int items = cbor_map_size(cmd->item);
    assert(items == 4);

    struct cbor_pair *mitems = cbor_map_handle(cmd->item);

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[0].key),
                        (int)cbor_string_length(mitems[0].key));
    fieldname[(int)cbor_string_length(mitems[0].key)] = 0;
    assert(strcmp(fieldname, "cmd") == 0);

    cmd->cmd = calloc((int)cbor_string_length(mitems[0].value) +1, sizeof(char));
    strncpy(cmd->cmd, (char *)cbor_string_handle(mitems[0].value),
                        (int)cbor_string_length(mitems[0].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[1].key),
                        (int)cbor_string_length(mitems[1].key));
    fieldname[(int)cbor_string_length(mitems[1].key)] = 0;
    assert(strcmp(fieldname, "opt") == 0);

    cmd->opt = calloc((int)cbor_string_length(mitems[1].value) +1, sizeof(char));
    strncpy(cmd->opt, (char *)cbor_string_handle(mitems[1].value),
                        (int)cbor_string_length(mitems[1].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[2].key),
                        (int)cbor_string_length(mitems[2].key));
    fieldname[(int)cbor_string_length(mitems[2].key)] = 0;
    assert(strcmp(fieldname, "actname") == 0);

    cmd->actname = calloc((int)cbor_string_length(mitems[2].value) +1, sizeof(char));
    strncpy(cmd->actname, (char *)cbor_string_handle(mitems[2].value),
                        (int)cbor_string_length(mitems[2].value));

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[3].key),
                        (int)cbor_string_length(mitems[3].key));
    fieldname[(int)cbor_string_length(mitems[3].key)] = 0;
    assert(strcmp(fieldname, "actid") == 0);
    cmd->actid = cbor_get_uint64(mitems[3].value);

    strncpy(fieldname, (const char *)cbor_string_handle(mitems[4].key),
                        (int)cbor_string_length(mitems[4].key));
    fieldname[(int)cbor_string_length(mitems[4].key)] = 0;
    assert(strcmp(fieldname, "args") == 0);

    cbor_item_t *arr = mitems[4].value;
    cmd->nitems = cbor_array_size(arr);
    cmd->args = (arg_t *)calloc(cmd->length, sizeof(arg_t));

    if (fmt != NULL && strlen(fmt) != cmd->length) {
        printf("ERROR! Message does not match the validation specification\n");
        return NULL;
    }

    // parse the array of args and fill in the local command structure..
    for (i = 0; i < cmd->nitems; i++) {

        switch (cbor_typeof(&arr[i])) {
            case CBOR_TYPE_UINT:
                if (fmt != NULL && fmt[i] != 'i') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = INT_TYPE;
                cmd->args[i].val.ival = cbor_get_uint32(&arr[i]);
                break;

            case CBOR_TYPE_NEGINT:
                if (fmt != NULL && fmt[i] != 'i') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = INT_TYPE;
                cmd->args[i].val.ival = -1 * cbor_get_uint32(&arr[i]);
                break;

            case CBOR_TYPE_STRING:
                if (fmt != NULL && fmt[i] != 's') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = STRING_TYPE;
                cmd->args[i].val.sval = (char *)cbor_string_handle(&arr[i]);
                break;

            case CBOR_TYPE_FLOAT_CTRL:
                if (fmt != NULL && fmt[i] != 'd') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = DOUBLE_TYPE;
                cmd->args[i].val.dval = cbor_float_get_float8(&arr[i]);
                break;
            case CBOR_TYPE_BYTESTRING:
                if (fmt != NULL && fmt[i] != 'n') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = NVOID_TYPE;
                cmd->args[i].val.nval = nvoid_new(cbor_bytestring_handle(&arr[i]), cbor_bytestring_length(&arr[i]));
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

    // decrement the reference to the CBOR object..
    if (cmd->item)
        cbor_decref(&cmd->item);
    free(cmd->args);
    free(cmd);
}


void command_print_arg(arg_t *arg)
{
    printf("\t\t");
    switch(arg->type) {
        case INT_TYPE:
            printf(" %d ", arg->val.ival);
            break;
        case STRING_TYPE:
            printf(" %s ", arg->val.sval);
            break;
        case DOUBLE_TYPE:
            printf(" %f ", arg->val.dval);
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
    printf("\nCommand buffer: ");
    for (i = 0; i < strlen((char *)cmd->buffer); i++)
        printf("%x", (int)cmd->buffer[i]);
    printf("\nCommand number of args: %d\n", cmd->nitems);

    for (i = 0; i < cmd->nitems; i++)
        command_print_arg(&cmd->args[i]);

    printf("\n");

    cbor_describe(cmd->item, stdout);
    printf("\n===================================\n");
}
