/*

The MIT License (MIT)
Copyright (c) 2015 Muthucumaru Maheswaran

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

#ifndef _TPARSER_H
#define _TPARSER_H

#include "toml.h"


#define MAX_NAME_LEN            32


typedef enum
{
    T_ERROR = 300,
    T_EOF_VALUE,
    T_NAME_VALUE,
    T_VALID_VALUE,
    T_TRUE_VALUE,
    T_FALSE_VALUE,
    T_ARRAY_VALUE,
    T_OBJECT_VALUE,
    T_STRING_VALUE,
    T_NUMBER_VALUE
} ReturnTypes;

/* Primary parser interface functions.. */
void t_init_parse(char *str);
TOMLValue *t_get_value();

int t_parse_doc();

int t_parse_name();
int t_parse_tname();
int t_parse_table();
int t_parse_value();
int t_parse_equal();

int t_parse_number();
int t_parse_string();
int t_parse_array();
int t_parse_true();
int t_parse_false();


#endif /* _TPARSER_H */

#ifdef __cplusplus
}
#endif
