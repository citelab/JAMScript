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

#include "json.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>


/*
 * JSONObject methods...
 */
JSONObject *create_object()
{
    JSONObject *jobj = (JSONObject *)calloc(1, sizeof(JSONObject));
    jobj->properties = (JSONProperty *)calloc(ALLOCED_NUM, sizeof(JSONProperty));
    jobj->count = 0;
    jobj->allocednum = ALLOCED_NUM;

    return jobj;
}


int add_property(JSONObject *jobj, char *name, JSONValue *val)
{
    JSONProperty *props;

    if (jobj->count >= jobj->allocednum) {
	/* reallocate the storage.. */
	props = (JSONProperty *)realloc(jobj->properties, (jobj->allocednum + ALLOCED_NUM) * sizeof(JSONProperty));
	if (props == NULL) {
	    perror("Unable to Reallocate Memory");
	    return -1;
	}
	jobj->properties = props;
	jobj->allocednum += ALLOCED_NUM;
    }
    /* Now add the actual property... */
    jobj->properties[jobj->count].name = strdup(name);
    jobj->properties[jobj->count].value = copy_value(val);
    jobj->count++;

    return 0;
}


int finalize_object(JSONObject *jobj)
{
    JSONProperty *props;

    /* Resize the memory allocation to fit the count.. excess memory is trimmed. */
    if (jobj->count < jobj->allocednum) {
	/* reallocate the storage.. */
	props = (JSONProperty *)realloc(jobj->properties, (jobj->count) * sizeof(JSONProperty));
	if (props == NULL) {
	    perror("Unable to Reallocate Memory");
	    return -1;
	}
	jobj->properties = props;
    }
    return 0;
}


JSONValue *find_property(JSONObject *jobj, char *name)
{
    if(jobj == NULL || name == NULL)
        return NULL;
    int i;
    for (i = 0; i < jobj->count; i++) {
	if (strcmp(name, jobj->properties[i].name) == 0)
	    return jobj->properties[i].value;
    }
    /* return an 'undefined' value.. which is returned by default
     * by create_value()
     */
    return create_value();
}


/*
 * JSONArray methods...
 */
JSONArray *create_array()
{
    JSONArray *jarr = (JSONArray *)calloc(1, sizeof(JSONArray));
    jarr->elems = (JSONValue *)calloc(ALLOCED_NUM, sizeof(JSONValue));
    jarr->length = 0;
    jarr->allocednum = ALLOCED_NUM;

    return jarr;
}


int add_element(JSONArray *jarr, JSONValue *elem)
{
    JSONValue *elems;

    if (jarr->length >= jarr->allocednum) {
	/* reallocate the storage.. */
	elems = (JSONValue *)realloc(jarr->elems, (jarr->allocednum + ALLOCED_NUM) * sizeof(JSONValue));
	if (elems == NULL) {
	    perror("Unable to Reallocate Memory");
	    return -1;
	}
	jarr->elems = elems;
	jarr->allocednum += ALLOCED_NUM;
    }
    /* Now add the actual element.. */
    jarr->elems[jarr->length] = *elem;
    jarr->length++;

    return 0;
}


int finalize_array(JSONArray *jarr)
{
    JSONValue *elems;

    if (jarr->length < jarr->allocednum) {
	/* reallocate the storage.. */
	elems = (JSONValue *)realloc(jarr->elems, jarr->length * sizeof(JSONValue

));
	if (elems == NULL) {
	    perror("Unable to Reallocate Memory");
	    return -1;
	}
	jarr->elems = elems;
    }
    return 0;
}


JSONValue *find_element(JSONArray *arr, int index)
{
    if (index < arr->length)
	return &(arr->elems[index]);
    else
	return create_value();
}


/*
 * JSONValue methods...
 */

JSONValue *create_value()
{
    JSONValue *jval = (JSONValue *)calloc(1, sizeof(JSONValue));
    jval->type = UNDEFINED;

    return jval;
}

/* Make a shallow copy of the value given by 'val'
 * Shallow copy means.. elements linked by the val is not copied
 */
JSONValue *copy_value(JSONValue *val)
{
    JSONValue *nval = create_value();
    nval->type = val->type;
    nval->val = val->val;

    return nval;
}

void set_true(JSONValue *jval)
{
    jval->type = JTRUE;
}


void set_false(JSONValue *jval)
{
    jval->type = JFALSE;
}


void set_null(JSONValue *jval)
{
    jval->type = JNULL;
}


void set_string(JSONValue *jval, char *str)
{
    jval->type = STRING;
    jval->val.sval = strdup(str);
}


void set_array(JSONValue *jval, JSONArray *arr)
{
    jval->type = ARRAY;
    jval->val.aval = arr;
}


void set_object(JSONValue *jval, JSONObject *obj)
{
    jval->type = OBJECT;
    jval->val.oval = obj;
}


void free_value(JSONValue *jval, int freeme)
{
    switch (jval->type) {
        case STRING:
            free(jval->val.sval);
            break;
        case ARRAY:
            free_array(jval->val.aval);
            break;
        case OBJECT:
            free_object(jval->val.oval);
            break;
        default:
        break;
    }
    if (freeme)
    free(jval);
}


void free_array(JSONArray *arr)
{
    int i;
    for(i = 0; i < arr->length; i++)
        free_value(&(arr->elems[i]), 0);

    free(arr->elems);
    free(arr);
}


void free_object(JSONObject *obj)
{
    int i;
    for(i = 0; i < obj->count; i++) {
        free_value(obj->properties[i].value, 1);
        free(obj->properties[i].name);
    }
    free(obj->properties);
    free(obj);
}


/*
 * query_value(jval, "sdsd", name, index, name, index)
 * format should be "s" or "d" - s for object property and d - for array index
 */
JSONValue *query_value(JSONValue *jval, char *fmt, ...)
{
    va_list args;
    JSONValue *cval = jval;
    JSONValue *rval = create_value();
    char *str;
    int indx;

    va_start(args, fmt);
    while (*fmt) {
        switch (*fmt++) {
	        case 's':
	            /* if not an object, return the 'undefined' */
	            if (cval->type != OBJECT) return rval;
	               str = va_arg(args, char *);
	            cval = find_property(cval->val.oval, str);
	        break;
	        case 'd':
	            if (cval->type != ARRAY) return rval;
	            indx = va_arg(args, int);
	            cval = find_element(cval->val.aval, indx);
	        break;
	    }
    }
    va_end(args);
    return cval;
}


/*
 * Dispose only frees a value of UNDEFINED type
 */
void dispose_value(JSONValue *val)
{
    if (val->type == UNDEFINED)
	free(val);
}

/*
 * JSONValue printing methods...
 */

/*
 * Converts a JSON value to string. We give it a
 * 'buf' that is big enough to contain the converted JSON
 * object. The function writes the JSON object into this buffer.
 * If it is NOT big enough, we return 0. Otherwise, we
 * return the number of characters written into the buffer + 1.
 * -------------UPDATE----------
 * This has been updated to properly exit without smashing stacks when buffer is too small for string
 * Implemented by the use of snprintf instead and preventing the buffer - cnt -1 < 0
 * Xiru Zhu
 */
int val_to_string(char **buf, int buflen, JSONValue *val)
{
    int cnt;
    int test;
    char *nbuf;

    //printf("Type %d\n", val->type);

    switch (val->type) {
    case UNDEFINED:
	cnt = snprintf(*buf, buflen," Undefined ");
	break;
    case JFALSE:
	cnt = snprintf(*buf, buflen, " False ");
	break;
    case JTRUE:
	cnt = snprintf(*buf, buflen, " True ");
	break;
    case JNULL:
	cnt = snprintf(*buf, buflen, " Null ");
	break;
    case INTEGER:
	cnt = snprintf(*buf, buflen, " %d ", val->val.ival);
	break;
    case DOUBLE:
	cnt = snprintf(*buf, buflen, " %f ", val->val.dval);
	break;
    case STRING:
	cnt = snprintf(*buf, buflen, " \"%s\" ", val->val.sval);
	break;
    case ARRAY:
	cnt = snprintf(*buf, buflen, "[");
    int i;
	for (i = 0; i < val->val.aval->length; i++) {
	    nbuf = *buf + cnt;
         if(buflen - (cnt + 1)< 0)
            return 0;
	    test = val_to_string(&nbuf, (buflen - cnt), &(val->val.aval->elems[i]));
        if(test == 0)
            return 0;
	    cnt += test;
        if (i < val->val.aval->length - 1) {
		  nbuf = *buf + cnt;
           if(buflen - (cnt + 1)< 0)
                return 0;
		  cnt += snprintf(nbuf, buflen - cnt ,", ");
	    }
	}
	nbuf = *buf + cnt;
    if(buflen - (cnt + 1)< 0)
            return 0;
	cnt += snprintf(nbuf, buflen,"]");
	break;
    case OBJECT:
	cnt = snprintf(*buf, buflen, "{");
	for (i = 0; i < val->val.oval->count; i++) {
	    nbuf = *buf + cnt;
        if(buflen - (cnt + 1)< 0)
            return 0;
	    cnt += snprintf(nbuf,buflen - cnt, " \"%s\" :", val->val.oval->properties[i].name);
	    nbuf = *buf + cnt;
        if(buflen - (cnt + 1)< 0)
            return 0;
	    test = val_to_string(&nbuf, (buflen -cnt), val->val.oval->properties[i].value);
        if(test == 0)
            return 0;
        cnt += test;
	    if (i < val->val.aval->length - 1) {
		nbuf = *buf + cnt;
        if(buflen - (cnt + 1)< 0)
            return 0;
		cnt += snprintf(nbuf, buflen - cnt, ", ");
	    }

	}
	nbuf = *buf + cnt;
    if(buflen - (cnt + 1)< 0)
            return 0;
	cnt += snprintf(nbuf, buflen, "}");
	break;
    default:
	cnt += snprintf(*buf, buflen, "<< other type >>");
    }

    /* +1 to accomodate the '\0' trailing at the end */
    return (buflen < cnt + 1) ? 0 : cnt;
}

/* Prints the value of a JSONValue
 * This has been updated to accommodate for very large strings
 * This is no longer upper bounded by MAX_PRINT_BUF, though the minimum 
 * string size is still MAX_PRINT_BUF
 */

void print_value(JSONValue *val)
{
    char * buf = (char *)calloc(MAX_PRINT_BUF, sizeof(char));
    int multiplier = 1;
    int printed = 0;
    for(int i = 0; i < 50; i++){
        if (val_to_string(&buf, MAX_PRINT_BUF * multiplier, val)){
	       printf("%s\n", buf);
           free(buf);
           printed ++;
           break;
        }
        else{
	       //printf("Printing ERROR!\n");
           multiplier *= 4;
           free(buf);
           buf = calloc(MAX_PRINT_BUF * multiplier, sizeof(char));
        }
    }
    if(!printed)
        printf("PRINTING ERROR\n");
}




