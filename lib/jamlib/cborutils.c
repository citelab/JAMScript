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

#include <cbor.h>
#include <string.h>
#include <math.h>

#include "cborutils.h"

void cbor_assert_field_string(cbor_item_t *item, char *str)
{
    char fieldname[64];

    strncpy(fieldname, (const char *)cbor_string_handle(item),
                        (int)cbor_string_length(item));
    fieldname[(int)cbor_string_length(item)] = 0;
    assert(strcmp(fieldname, str) == 0);
}

char *cbor_get_string(cbor_item_t *item)
{
    char *buf = calloc((int)cbor_string_length(item) +1, sizeof(char));
    strncpy(buf, (char *)cbor_string_handle(item),
                 (int)cbor_string_length(item));
    return buf;
}


float cbor_get_float(cbor_item_t *item)
{
    int t = cbor_typeof(item);
    if (t == CBOR_TYPE_NEGINT || t == CBOR_TYPE_UINT) {
        printf("WARNING! Int value in the stream.. \n");
        int i = cbor_get_integer(item);
        return (float)i;
    } else {
        return cbor_float_get_float8(item);
    }
}


int cbor_get_integer(cbor_item_t *item)
{
    // Check if the other side is sending a float.. if so
    // print a warning and convert to integer
    if (cbor_typeof(item) == CBOR_TYPE_FLOAT_CTRL) {
        printf("WARNING! Float value in the stream..\n");
        float f = cbor_get_float(item);
        return (int)lround(f);
    } else {

        switch (cbor_int_get_width(item)) {
            case CBOR_INT_8:
            if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
                return -1 * cbor_get_uint8(item);
            else
                return cbor_get_uint8(item);
            break;

            case CBOR_INT_16:
            if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
                return -1 * cbor_get_uint16(item);
            else
                return cbor_get_uint16(item);
            break;

            case CBOR_INT_32:
            if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
                return -1 * cbor_get_uint32(item);
            else
                return cbor_get_uint32(item);
            break;

            case CBOR_INT_64:
            if (cbor_typeof(item) == CBOR_TYPE_NEGINT)
                return -1 * cbor_get_uint64(item);
            else
                return cbor_get_uint64(item);
            break;

        }
        // error condition
        return -1;
    }
}
