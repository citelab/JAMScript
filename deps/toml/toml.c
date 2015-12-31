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

#include "TOML.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>

/*
 * Simple create for date
 */
TOMLDate *t_create_date(){
    TOMLDate *val = (TOMLDate *)calloc(1, sizeof(TOMLDate));
    val->dston = 0;    
    return val;
}

/*
 * TOMLObject methods...
 */
TOMLObject *t_create_object()
{
    TOMLObject *jobj = (TOMLObject *)calloc(1, sizeof(TOMLObject));
    jobj->properties = (TOMLProperty *)calloc(ALLOCED_NUM, sizeof(TOMLProperty));
    jobj->count = 0;
    jobj->allocednum = ALLOCED_NUM;

    return jobj;
}



/*
 * This function assumes there are no duplicates. We need to make a duplicate
 * check before calling this function. If duplicate is found, we could just report
 * it and skip the insertion.. Done outside this function.
 */
int t_add_property(TOMLObject *obj, TOMLName *name, TOMLValue *val)
{
    TOMLProperty *props;

    if (obj->count >= obj->allocednum) {
        // reallocate the storage..
        props = (TOMLProperty *)realloc(obj->properties, (obj->allocednum + ALLOCED_NUM) * sizeof(TOMLProperty));
        if (props == NULL) {
            perror("Unable to Reallocate Memory");
            return -1;
        }
        obj->properties = props;
        obj->allocednum += ALLOCED_NUM;
    }
    // Now add the actual property...
    if (name->nums == 1) {
        // No need to check for duplicates here.
        obj->properties[obj->count].name = strdup(name->names[0]);
        obj->properties[obj->count].value = t_copy_value(val);
        obj->count++;
    } else {
        // At least the last level is different.. we can have existing upper level names..
        // We need not insert an object if the name is already found.
        TOMLName *n;
        t_splice_first_name(&n, name);

        TOMLValue *v = t_find_property_with_str(obj, n->names[0]);
        if (v->type == T_UNDEFINED) {
            TOMLObject *o = t_create_object();
            t_set_object(v, o);
            t_add_property(o, name, val);

            obj->properties[obj->count].name = strdup(n->names[0]);
            obj->properties[obj->count].value = v;
            obj->count++;
            t_free_name(n);
        } else if (v->type == T_OBJECT) {
            TOMLObject *o = v->val.oval;
            t_add_property(o, name, val);
        } else
            return -1;
    }
    return 0;
}


int t_finalize_object(TOMLObject *jobj)
{
    TOMLProperty *props;

    // Resize the memory allocation to fit the count.. excess memory is trimmed.
    if (jobj->count < jobj->allocednum) {
        // reallocate the storage..
        props = (TOMLProperty *)realloc(jobj->properties, (jobj->count) * sizeof(TOMLProperty));
        if (props == NULL) {
            perror("Unable to Reallocate Memory");
            return -1;
        }
        jobj->properties = props;
    }
    return 0;
}


TOMLValue *t_find_property_with_name(TOMLObject *jobj, TOMLName *name)
{
    int i, j;
    TOMLObject *this = jobj;
    int found = 0;

    for (i = 0; i < name->nums; i++) {
        for (j = 0; j < this->count; j++) {
            if (strcmp(name->names[i], this->properties[j].name) == 0) {
                this = this->properties[i].value->val.oval;
                found = 1;
            }
        }
        // if not found return 'undefined'
        if (!found) return t_create_value();
    }

    // return is the one we are looking for..
    TOMLValue *rv = t_create_value();
    t_set_object(rv, this);
    return rv;
}


TOMLValue *t_find_property_with_str(TOMLObject *jobj, char *name)
{
    int j;

    for (j = 0; j < jobj->count; j++) {
        if (strcmp(name, jobj->properties[j].name) == 0)
            return jobj->properties[j].value;
    }

    // if did not find.. return 'undefined'
    return t_create_value();
}


void t_free_object(TOMLObject *obj)
{
    int i;

    free(obj->name);
    for(i = 0; i < obj->count; i++) {
        t_free_value(obj->properties[i].value, 1);
        free(obj->properties[i].name);
    }
    free(obj->properties);
    free(obj);
}


/*
 * TOMLArray methods...
 */
TOMLArray *t_create_array()
{
    TOMLArray *jarr = (TOMLArray *)calloc(1, sizeof(TOMLArray));
    jarr->elems = (TOMLValue *)calloc(ALLOCED_NUM, sizeof(TOMLValue));
    jarr->length = 0;
    jarr->allocednum = ALLOCED_NUM;

    return jarr;
}


int t_add_element(TOMLArray *jarr, TOMLValue *elem)
{
    TOMLValue *elems;

    if (jarr->length >= jarr->allocednum) {
        // reallocate the storage..
        elems = (TOMLValue *)realloc(jarr->elems, (jarr->allocednum + ALLOCED_NUM) * sizeof(TOMLValue));
        if (elems == NULL) {
            perror("Unable to Reallocate Memory");
            return -1;
        }
        jarr->elems = elems;
        jarr->allocednum += ALLOCED_NUM;
    }
    // Now add the actual element..
    jarr->elems[jarr->length] = *elem;
    jarr->length++;

    return 0;
}


int t_finalize_array(TOMLArray *jarr)
{
    TOMLValue *elems;

    if (jarr->length < jarr->allocednum) {
        // reallocate the storage..
        elems = (TOMLValue *)realloc(jarr->elems, jarr->length * sizeof(TOMLValue));
        if (elems == NULL) {
            perror("Unable to Reallocate Memory");
            return -1;
        }
        jarr->elems = elems;
    }
    return 0;
}


TOMLValue *t_find_element(TOMLArray *arr, int index)
{
    if (index < arr->length)
        return &(arr->elems[index]);
    else
        return t_create_value();
}


void t_free_array(TOMLArray *arr)
{
    int i;
    for(i = 0; i < arr->length; i++)
        t_free_value(&(arr->elems[i]), 0);

    free(arr->elems);
    free(arr);
}


/*
 * TOMLValue methods...
 */


/*
 * query_value(jval, "sdsd", name, index, name, index)
 * format should be "s" or "d" - s for Object property and d - for array index
 */
TOMLValue *t_query_value(TOMLValue *jval, char *fmt, ...)
{
    va_list args;
    TOMLValue *cval = jval;
    TOMLValue *rval = t_create_value();
    char *str;
    int indx;

    va_start(args, fmt);
    while (*fmt) {
         switch (*fmt++) {
 	        case 's':
 	            // if not an Object, return the 'T_UNDEFINED'
 	            if (cval->type != T_OBJECT) return rval;
 	               str = va_arg(args, char *);
 	            cval = t_find_property_with_str(cval->val.oval, str);
 	        break;
 	        case 'd':
 	            if (cval->type != T_ARRAY) return rval;
 	            indx = va_arg(args, int);
 	            cval = t_find_element(cval->val.aval, indx);
 	        break;
 	    }
     }
     va_end(args);
     //TODO: Looks like rval is not freed
     return cval;
}


TOMLValue *t_create_value()
{
    TOMLValue *jval = (TOMLValue *)calloc(1, sizeof(TOMLValue));
    jval->type = T_UNDEFINED;

    return jval;
}

// Make a shallow copy of the value given by 'val'
// Shallow copy means.. elements linked by the val is not copied
TOMLValue *t_copy_value(TOMLValue *val)
{
    TOMLValue *nval = t_create_value();
    nval->type = val->type;
    nval->val = val->val;

    return nval;
}


// Returns 1 (true) if the TOMLValue holds a TRUE value for the BOOLEAN
//
int t_is_true(TOMLValue *tval)
{
    if ((tval->type == T_BOOLEAN) && (tval->val.ival == TRUE))
        return TRUE;
    else
        return FALSE;
}

// Returns 1 (true) if the TOMLValue holds a FALSE value for the BOOLEAN
//
int t_is_false(TOMLValue *tval)
{
    if ((tval->type == T_BOOLEAN) && (tval->val.ival == FALSE))
        return TRUE;
    else
        return FALSE;
}


// Set the value to TRUE and the type to BOOLEAN
void t_set_true(TOMLValue *jval)
{
    jval->type = T_BOOLEAN;
    jval->val.ival = TRUE;
}

// Set the value to FALSE and the type to BOOLEAN
void t_set_false(TOMLValue *jval)
{
    jval->type = T_BOOLEAN;
    jval->val.ival = FALSE;
}

void t_set_string(TOMLValue *jval, char *str)
{
    jval->type = T_STRING;
    jval->val.sval = strdup(str);
}


void t_set_array(TOMLValue *jval, TOMLArray *arr)
{
    jval->type = T_ARRAY;
    jval->val.aval = arr;
}


void t_set_object(TOMLValue *jval, TOMLObject *obj)
{
    jval->type = T_OBJECT;
    jval->val.oval = obj;
}


void t_set_name(TOMLValue *val, TOMLName *name)
{
    val->type = T_NAME;
    val->val.nval = name;
}


void t_free_value(TOMLValue *jval, int freeme)
{
    switch (jval->type) {
        case T_STRING:
            free(jval->val.sval);
            break;
        case T_ARRAY:
            t_free_array(jval->val.aval);
            break;
        case T_OBJECT:
            t_free_object(jval->val.oval);
            break;
        default:
        break;
    }
    if (freeme)
        free(jval);
}


int is_defined(TOMLValue *val)
{
    return val->type != T_UNDEFINED;
}


char *t_typeof(TOMLValue *val)
{
    switch (val->type) {
        case T_UNDEFINED:
            return "undefined";
        case T_BOOLEAN:
        case T_INTEGER:
        case T_DOUBLE:
            return "number";
        case T_STRING:
        case T_NAME:
            return "string";
        case T_DATETIME:
            return "date";
        case T_ARRAY:
            return "array";
        case T_OBJECT:
            return "object";
    }
}


/**
 * Returns the count of the attributes in an object.. otherwise returns 0
 */

int t_count(TOMLValue *val)
{
    if (val->type != T_OBJECT)
        return 0;

    return val->val.oval->count;
}


/**
 * The buffer size in the code below should be adjusted. We need to remove This
 * restriction and make it dynamic..
 */

void t_print_value(TOMLValue *val)
{
    char buf[MAX_PRINT_BUF];
    char *pbuf = buf;

    if (t_val_to_string(&pbuf, MAX_PRINT_BUF, val))
        printf("%s\n", pbuf);
    else
        printf("Printing ERROR!\n");
}


/*
 * Converts a TOML value to string. We give it a
 * 'buf' that is big enough to contain the converted TOML
 * value. The function writes the TOML value into this buffer.
 * If it is NOT big enough, we return 0. Otherwise, we
 * return the number of characters written into the buffer + 1.
 *
 * TODO: This would not work with large TOML files..
 * We are using a 1024 buffer for the printed string!
 */
int t_val_to_string(char **buf, int buflen, TOMLValue *val)
{
    int cnt = 0;
    char *nbuf;
    char buffer[128];
    //printf("Type %d\n", val->type);

    switch (val->type) {
        case T_BOOLEAN:
            if (val->val.ival == TRUE)
                cnt = sprintf(*buf, " true ");
            else
                cnt = sprintf(*buf, " false ");
            break;
        case T_INTEGER:
            cnt = sprintf(*buf, " %d ", val->val.ival);
            break;
        case T_DOUBLE:
            cnt = sprintf(*buf, " %f ", val->val.dval);
            break;
        case T_STRING:
            cnt = sprintf(*buf, " \"%s\" ", val->val.sval);
            break;
        case T_ARRAY:
            cnt = sprintf(*buf, "[");
            for (int i = 0; i < val->val.aval->length; i++) {
                nbuf = *buf + cnt;
                cnt += t_val_to_string(&nbuf, (buflen - cnt), &(val->val.aval->elems[i]));
                if (i < val->val.aval->length - 1) {
                    nbuf = *buf + cnt;
                    cnt += sprintf(nbuf, ", ");
                }
            }
            nbuf = *buf + cnt;
            cnt += sprintf(nbuf, "]");
            break;
        case T_NAME:
            cnt = sprintf(*buf, " %s ", val->val.nval->names[0]);
            for (int i = 1; i < val->val.nval->nums; i++) {
                nbuf = *buf + cnt;
                cnt += sprintf(nbuf, ". %s", val->val.nval->names[i]);
            }
            break;
        case T_OBJECT:
            cnt = sprintf(*buf, "{");
            for (int i = 0; i < val->val.oval->count; i++) {
                nbuf = *buf + cnt;
                cnt += sprintf(nbuf, " \"%s\" :", val->val.oval->properties[i].name);
                nbuf = *buf + cnt;
                cnt += t_val_to_string(&nbuf, (buflen -cnt), val->val.oval->properties[i].value);
                if (i < val->val.aval->length - 1) {
                    nbuf = *buf + cnt;
                    cnt += sprintf(nbuf, ", ");
                }
            }
            nbuf = *buf + cnt;
            cnt += sprintf(nbuf, "}");
            break;
        case T_DATETIME:
            get_time(&val->val.dtval->date, buffer);
            cnt += sprintf(*buf, "%s", buffer);
            break;
        default:
            cnt += sprintf(*buf, "<< other type >>");
    }

    // +1 to accomodate the '\0' trailing at the end
    return (buflen < cnt + 1) ? 0 : cnt;
}


/*
 * TOMLName methods..
 *
 */

TOMLName *t_create_name()
{
    TOMLName *n = (TOMLName *)calloc(1, sizeof(TOMLName));
    n->nums = 0;

    return n;
}

int t_add_name(TOMLName *name, char *n)
{
    if (name->nums < MAX_NAMES) {
        name->names[name->nums++] = strdup(n);
        return 0;
    } else
        return -1;
}

int t_splice_first_name(TOMLName **new, TOMLName *old)
{
    TOMLName *n = t_create_name();
    n->nums = 1;
    n->names[0] = old->names[0];
    old->nums--;

    for(int i = 0; i < old->nums; i++)
        old->names[i] = old->names[i+1];

    *new = n;
    return 0;
}

void t_free_name(TOMLName *name)
{
    int i;

    for (i = 0; i < name->nums; i++)
        free(name->names[i]);
    free(name);
}
