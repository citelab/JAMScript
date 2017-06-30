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

#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

#ifndef __TOML_H__
#define __TOML_H__

// This is the number of properties allocated at any given time.
// We realloc more properties as needed.

#define ALLOCED_NUM                         16
#define MAX_PRINT_BUF                       1024
#define MAX_NAMES                           16
#define TRUE                                1
#define FALSE                               0


typedef enum TOMLType
{
    T_UNDEFINED,
    T_BOOLEAN,
    T_INTEGER,
    T_DOUBLE,
    T_STRING,
    T_NAME,
    T_DATETIME,
    T_ARRAY,
    T_OBJECT
} TOMLType;

typedef struct TOMLArray TOMLArray;
typedef struct TOMLObject TOMLObject;
typedef struct TOMLName TOMLName;
typedef struct TOMLDate TOMLDate;

union DataValueType
{
    int ival;
    double dval;
    char *sval;
    TOMLName *nval;
    TOMLDate *dtval;
    TOMLArray *aval;
    TOMLObject *oval;
} val;

typedef struct TOMLValue
{
    TOMLType type;
    union DataValueType val;
} TOMLValue;

struct TOMLName
{
    int nums;
    char *names[MAX_NAMES];
};

struct TOMLArray
{
    int allocednum;
    int length;
    TOMLValue *elems;
};

typedef struct TOMLProperty
{
    char *name;
    TOMLValue *value;
} TOMLProperty;

struct TOMLDate
{
    char name[30];
    struct tm date;
    int dston;
    int extended;
};

struct TOMLObject
{
    char *name;
    int allocednum;
    int count;
    TOMLProperty *properties;
};

TOMLDate *t_create_date();

/*
 * TOMLObject methods..
 */
TOMLObject *t_create_object();
// Object owns the value after it is added as property
// This means the 'val' can be changed later on...
int t_add_property(TOMLObject *tobj, TOMLName *name, TOMLValue *val);
int t_finalize_object(TOMLObject *tobj);
TOMLValue *t_find_property_with_name(TOMLObject *jobj, TOMLName *name);
TOMLValue *t_find_property_with_str(TOMLObject *jobj, char *name);

/*
 * TOMLArray methods..
 */
TOMLArray *t_create_array();
// Array owns the value after it is inserted into the array
// This means the value can be changed later on..
int t_add_element(TOMLArray *tarr, TOMLValue *elem);
int t_finalize_array(TOMLArray *tarr);
TOMLValue *t_find_element(TOMLArray *tarr, int index);


/*
 * TOMLValue methods..
 */
TOMLValue *t_query_value(TOMLValue *jval, char *fmt, ...);
TOMLValue *t_create_value();
TOMLValue *t_copy_value(TOMLValue *val);
int is_defined(TOMLValue *val);
void t_set_true(TOMLValue *jval);
void t_set_false(TOMLValue *jval);
void t_set_string(TOMLValue *jval, char *str);
void t_set_array(TOMLValue *jval, TOMLArray *arr);
void t_set_object(TOMLValue *jval, TOMLObject *obj);
void t_set_name(TOMLValue *val, TOMLName *name);
void t_free_value(TOMLValue *jval, int freeme);
void t_free_array(TOMLArray *arr);
void t_free_object(TOMLObject *obj);
char *t_typeof(TOMLValue *val);
int t_count(TOMLValue *val);

/*
 * TOMLValue printing methods...
 */
void t_print_value(TOMLValue *val);
int t_val_to_string(char **buf, int buflen, TOMLValue *val);

/*
 * TOMLName methods..
 */
TOMLName *t_create_name();
int t_add_name(TOMLName *name, char *n);
void t_free_name(TOMLName *name);
int t_splice_first_name(TOMLName **new, TOMLName *old);
void t_free_name(TOMLName *name);


#endif /* __TOML_H__ */

#ifdef __cplusplus
}
#endif
