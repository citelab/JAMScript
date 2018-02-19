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

#ifndef _JSON_H
#define _JSON_H

#define ALLOCED_NUM                      16
#define MAX_PRINT_BUF                    256

typedef enum JSONType
{
    UNDEFINED,
    JFALSE,
    JTRUE,
    JNULL,
    INTEGER,
    DOUBLE,
    STRING,
    ARRAY,
    OBJECT
} JSONType;

typedef struct JSONArray JSONArray;
typedef struct JSONObject JSONObject;

union DataValueType {
    int ival;
    double dval;
    char *sval;
    JSONArray *aval;
    JSONObject *oval;
} val;

typedef struct JSONValue
{
    JSONType type;
    union DataValueType val;
} JSONValue;

struct JSONArray
{
    int allocednum;
    int length;
    JSONValue *elems;
};

typedef struct JSONProperty
{
    char *name;
    JSONValue *value;
} JSONProperty;

struct JSONObject
{
    int allocednum;
    int count;
    JSONProperty *properties;
};

/*
 * JSONObject methods..
 */
JSONObject *create_object();
/* Object owns the value after it is added as property
 * This means the 'val' can be changed later on...
 */
int add_property(JSONObject *jobj, char *name, JSONValue *val);
int finalize_object(JSONObject *jobj);
JSONValue *find_property(JSONObject *jobj, char *name);


/*
 * JSONArray methods..
 */
JSONArray *create_array();
/* Array owns the value after it is inserted into the array
 * This means the value can be changed later on..
 */
int add_element(JSONArray *jarr, JSONValue *elem);
int finalize_array(JSONArray *jarr);
JSONValue *find_element(JSONArray *jarr, int index);


/*
 * JSONValue methods..
 */
JSONValue *query_value(JSONValue *jval, char *fmt, ...);
JSONValue *create_value();
JSONValue *copy_value(JSONValue *val);
void set_true(JSONValue *jval);
void set_false(JSONValue *jval);
void set_null(JSONValue *jval);
void set_string(JSONValue *jval, char *str);
void set_array(JSONValue *jval, JSONArray *arr);
void set_object(JSONValue *jval, JSONObject *obj);
void free_value(JSONValue *jval, int freeme);
void free_array(JSONArray *arr);
void free_object(JSONObject *obj);

/* Dispose only frees a value of UNDEFINED type
 * Different from free_value()
 */
void dispose_value(JSONValue *val);

/*
 * JSONValue printing methods...
 */
void print_value(JSONValue *val);
int val_to_string(char **buf, int buflen, JSONValue *val);


#endif /* _JSON_H */

#ifdef __cplusplus
}
#endif
