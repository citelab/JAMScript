/*

The MIT License (MIT)
Copyright (c) 2014 Muthucumaru Maheswaran

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


#ifndef _JPARSER_H
#define _JPARSER_H

#include "json.h"


typedef enum
{
    ERROR = 200,
    VALID_VALUE,
    TRUE_VALUE,
    FALSE_VALUE,
    NULL_VALUE,
    COLON_VALUE,
    COMMA_VALUE,
    BEGIN_ARRAY,
    END_ARRAY,
    BEGIN_OBJECT,
    END_OBJECT,
    ARRAY_VALUE,
    OBJECT_VALUE,
    QUOTE_VALUE,
    STRING_VALUE,
    NUMBER_VALUE,
    UNDEFINED_VALUE
} ReturnTypes;

/* Primary parser interface functions.. */
void init_parse(char *str);
JSONValue *get_value();
int parse_value();
void print_string();

/* Secondary parser interface functions.. could be rarely used */
int parse_true();
int parse_false();
int parse_null();
int parse_array();
int parse_object();
int parse_string();
int parse_number();
int parse_undefined();

#endif /* _JPARSER_H */

#ifdef __cplusplus
}
#endif
