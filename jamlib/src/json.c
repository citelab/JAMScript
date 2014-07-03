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
	// reallocate the storage..
	props = (JSONProperty *)realloc(jobj->properties, (jobj->allocednum + ALLOCED_NUM) * sizeof(JSONProperty));
	if (props == NULL) {
	    perror("Unable to Reallocate Memory");
	    return -1;
	}
	jobj->properties = props;
	jobj->allocednum += ALLOCED_NUM;
    }
    // Now add the actual property...
    jobj->properties[jobj->count].name = strdup(name);
    jobj->properties[jobj->count].value = val;
    jobj->count++;

    return 0;
}


int finalize_object(JSONObject *jobj)
{
    JSONProperty *props;

    // Resize the memory allocation to fit the count.. excess memory is trimmed.
    if (jobj->count < jobj->allocednum) {
	// reallocate the storage..
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
    int i;
    for (i = 0; i < jobj->count; i++) {
	if (strcmp(name, jobj->properties[i].name) == 0)
	    return jobj->properties[i].value;
    }
    // return an 'undefined' value.. which is returned by default
    // by create_value()
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
	// reallocate the storage..
	elems = (JSONValue *)realloc(jarr->elems, (jarr->allocednum + ALLOCED_NUM) * sizeof(JSONValue));
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


int finalize_array(JSONArray *jarr)
{
    JSONValue *elems;

    if (jarr->length < jarr->allocednum) {
	// reallocate the storage..
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


void free_value(JSONValue *jval)
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
    free(jval);
}

void free_array(JSONArray *arr)
{
    int i;
    for(i = 0; i < arr->length; i++)
	free_value(&(arr->elems[i]));
    free(arr->elems);
    free(arr);
}


void free_object(JSONObject *obj)
{
    int i;
    for(i = 0; i < obj->count; i++) {
	free_value(obj->properties[i].value);
	free(obj->properties[i].name);
    }
    free(obj->properties);
    free(obj);
}
