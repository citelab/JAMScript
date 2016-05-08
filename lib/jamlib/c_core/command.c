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
#include "cborutils.h"


arg_t *command_clone_arg(arg_t *arg)
{
    arg_t *val = (arg_t *)calloc(1, sizeof(arg_t));
    assert(val != NULL);
    
    val->type = arg->type;
    if (arg->type == INT_TYPE) 
    {
        val->val.ival = arg->val.ival;
        return arg;
    }
    
    if (arg->type == DOUBLE_TYPE) 
    {
        val->val.dval = arg->val.dval;
        return arg;
    }
    
    if (arg->type == STRING_TYPE) 
    {
        val->val.sval = strdup(arg->val.sval);
        return arg;
    }
    
    if (arg->type == NVOID_TYPE) 
    {
        val->val.nval = nvoid_new(arg->val.nval->data, arg->val.nval->len);
        return arg;
    }
    
    return NULL;
}



/*
 * Return a command in CBOR format (as an unsigned char array) that can be sent out..
 *
 * The format is a 5-member object:
 *         cmd: command name: RPC, PING, REGISTER, etc (see command.txt for a
 *              full list of commands)
 *         actarg: 64 bit integer ID of the activity - 0 if not activity
  *         args: array of arguments to the command
 *
 * Limitations: We have limitations in the types of arguments that can be encoded.
 * At this time, they should all be primary types.
 *
 * format - s (string), i (integer) f,d for float/double - no % (e.g., "si")
 *
 */
command_t *command_new_using_cbor(const char *cmd, char *opt, char *actname, char *actid, char *actarg,
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
    cmdo->actarg = strdup(actarg);

    cmdo->args = args;
    cmdo->nargs = nargs;

    /*
     * Format of the CBOR map is as follows in equivalent JSON syntax
     * {cmd: Command_String, actarg: Activity ID, args: [Array of args]}
     */


    cbor_item_t *rmap = cbor_new_definite_map(6);

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

    // Add the actarg field to the map
    cbor_map_add(rmap, (struct cbor_pair) {
        .key = cbor_move(cbor_build_string("actarg")),
        .value = cbor_move(cbor_build_string(actarg))
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
command_t *command_new(const char *cmd, char *opt, char *actname, char *actid, char *actarg, const char *fmt, ...)
{
    va_list args;
    nvoid_t *nv;
    arg_t *qargs;
    int i = 0;
    
    if (strlen(fmt) > 0)
        qargs = (arg_t *)calloc(strlen(fmt), sizeof(arg_t));
    else
        qargs = NULL;        

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

    command_t *c = command_new_using_cbor(cmd, opt, actname, actid, actarg, arr, qargs, i);
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
    assert(items == 6);

    struct cbor_pair *mitems = cbor_map_handle(cmd->cdata);

    cbor_assert_field_string(mitems[0].key, "cmd");
    cmd->cmd = cbor_get_string(mitems[0].value);

    cbor_assert_field_string(mitems[1].key, "opt");
    cmd->opt = cbor_get_string(mitems[1].value);

    cbor_assert_field_string(mitems[2].key, "actname");
    cmd->actname = cbor_get_string(mitems[2].value);

    cbor_assert_field_string(mitems[3].key, "actid");
    cmd->actid = cbor_get_string(mitems[3].value);

    cbor_assert_field_string(mitems[4].key, "actarg");
    cmd->actarg = cbor_get_string(mitems[4].value);

    cbor_assert_field_string(mitems[5].key, "args");

    cbor_item_t *arr = mitems[5].value;
    cmd->nargs = cbor_array_size(arr);
    if (cmd->nargs > 0)
        cmd->args = (arg_t *)calloc(cmd->nargs, sizeof(arg_t));
    else
        cmd->args = NULL;

    if (fmt != NULL && strlen(fmt) != cmd->nargs) {
        printf("ERROR! Message does not match the validation specification\n");
        return NULL;
    }
    cbor_item_t **arrl = cbor_array_handle(arr);
    // parse the array of args and fill in the local command structure..
    for (i = 0; i < cmd->nargs; i++) {
        switch (cbor_typeof(arrl[i])) {
            case CBOR_TYPE_UINT:
            case CBOR_TYPE_NEGINT:
                if (fmt != NULL && fmt[i] != 'i') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = INT_TYPE;
                cmd->args[i].val.ival = cbor_get_integer(arrl[i]);
                break;

            case CBOR_TYPE_STRING:
                if (fmt != NULL && fmt[i] != 's') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = STRING_TYPE;
                cmd->args[i].val.sval = cbor_get_string(arrl[i]);
                break;

            case CBOR_TYPE_FLOAT_CTRL:
                if (fmt != NULL && fmt[i] != 'd') {
                    printf("ERROR! Message does not match the validation specification\n");
                    return NULL;
                }
                cmd->args[i].type = DOUBLE_TYPE;
                cmd->args[i].val.dval = cbor_float_get_float8(arrl[i]);
                break;
            case CBOR_TYPE_BYTESTRING:
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
    free(cmd->actarg);
    
    // TODO: What else? Something is missing here..

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
    printf("\nCommand activity arg: %s\n", cmd->actarg);


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


bool only_one_null(void *p, void *q)
{
    if (p == NULL && q != NULL)
        return true;
    if (p != NULL && q == NULL)
        return true;

    return false;           
}


bool string_equal(char *p, char *q)
{
    if (p == NULL && q == NULL)
        return true;

    if (strcmp(p, q) == 0)
        return true;
    else
        return false;    
}

bool command_equal(command_t *f, command_t *s)
{
    if (only_one_null(f->cmd, s->cmd))
        return false;
    if (only_one_null(f->opt, s->opt))
        return false;       
    if (only_one_null(f->actname, s->actname))
        return false;
    if (only_one_null(f->actid, s->actid))
        return false;
    if (only_one_null(f->actarg, s->actarg))
        return false;
    if (only_one_null(f->buffer, s->buffer))
        return false;
    if (only_one_null(f->cdata, s->cdata))
        return false;
    if (only_one_null(f->args, s->args))
        return false;
        
    if (string_equal(f->cmd, s->cmd) &&
        string_equal(f->opt, s->opt) &&
        string_equal(f->actname, s->actname) &&
        string_equal(f->actid, s->actid) &&
        string_equal(f->actarg, s->actarg) &&
        string_equal((char *)f->buffer, (char *)s->buffer))
        return true;
    else
        return false;
    
    return false;
}