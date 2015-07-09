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

#include "jparser.h"
#include "json.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

static char *_parse_str;
static int _loc;
static int _len;
// parsed value is passed using the parameter..
static JSONValue *rval;

int _peek_value();
void _consume_char();
void _parse_white();
int _char_in_string();
int _parse_colon();
int _parse_quote();
int _parse_comma();
int _parse_eobj();
int _parse_bobj();
int _parse_earr();
int _parse_barr();
char *_get_char();


/*
 * Setup the parse process...
 */
void init_parse(char *str)
{
    _parse_str = str;
    _loc = 0;
    _len = strlen(str);
}


/*
 * Return a pointer to the global variable holding the parsed JSON value..
 */
JSONValue *get_value()
{
    return rval;
}


/*
 * Global variable rval is set by the 'parse_' functions called here.
 * There is no need to manipulate that variable here.. we just need to pass
 * along to the next iteration..
 */
int parse_value()
{

    _parse_white();
    int nextchar = _peek_value();

    switch(nextchar)
	{
	case ' ':
	    _consume_char();
	    break;
	case 't':
	    return (parse_true() == ERROR) ? ERROR : VALID_VALUE;
	case 'f':
	    return (parse_false() == ERROR) ? ERROR : VALID_VALUE;
	case 'n':
	    return (parse_null() == ERROR) ? ERROR : VALID_VALUE;
	case '[':
	    return (parse_array() == ERROR) ? ERROR : VALID_VALUE;
	case '{':
	    return (parse_object() == ERROR) ? ERROR : VALID_VALUE;
	case '"':
	    return (parse_string() == ERROR) ? ERROR : VALID_VALUE;
	case '-':
	    return (parse_number() == ERROR) ? ERROR : VALID_VALUE;
	default:
	    if ((nextchar >= '0') && (nextchar <= '9'))
		return (parse_number() == ERROR) ? ERROR : VALID_VALUE;
	}
    return ERROR;
}


void print_string()
{
    printf("Parse string %s\n", &_parse_str[_loc]);
}

int parse_true()
{
    int sloc = _loc;
    JSONValue *val = create_value();

    _parse_white();
    if ((_parse_str[_loc++] == 't') && (_parse_str[_loc++] == 'r') &&
        (_parse_str[_loc++] == 'u') && (_parse_str[_loc++] == 'e')) {
        set_true(val);
        rval = val;
        return TRUE_VALUE;
    } else {
        free(val);
        _loc = sloc;
        return ERROR;
    }
}


int parse_false()
{
    int sloc = _loc;
    JSONValue *val = create_value();

    _parse_white();
    if ((_parse_str[_loc++] == 'f') &&
	(_parse_str[_loc++] == 'a') &&
	(_parse_str[_loc++] == 'l') &&
	(_parse_str[_loc++] == 's') &&
	(_parse_str[_loc++] == 'e')) {
	set_false(val);
	rval = val;
	return FALSE_VALUE;
    } else {
	free(val);
	_loc = sloc;
	return ERROR;
    }
}


int parse_null()
{
    int sloc = _loc;
    JSONValue *val = create_value();

    _parse_white();
    if ((_parse_str[_loc++] == 'n') &&
	(_parse_str[_loc++] == 'u') &&
	(_parse_str[_loc++] == 'l') &&
	(_parse_str[_loc++] == 'l')) {
	set_null(val);
	rval = val;
	return NULL_VALUE;
    } else {
	free(val);
	_loc = sloc;
	return ERROR;
    }
}


int parse_array()
{
    JSONValue *val = create_value();
    JSONArray *arr = create_array();
    set_array(val, arr);


    if (_parse_barr() == BEGIN_ARRAY) {

        while (_peek_value() != ']') {

            if (parse_value() == ERROR) return ERROR;
    	    add_element(arr, rval);
            if (_peek_value() == ',')
                _parse_comma();
        }
        finalize_array(arr);
        rval = val;
        return _parse_earr() == END_ARRAY ? ARRAY_VALUE : ERROR;
    }
    return ERROR;
}


int parse_object()
{
    JSONValue *savedval;
    JSONValue *val = create_value();
    JSONObject *obj = create_object();
    set_object(val, obj);

    if (_parse_bobj() == BEGIN_OBJECT) {
	do {
	    if (parse_string() == ERROR) return ERROR;
	    savedval = rval;
	    if (_parse_colon() == ERROR) return ERROR;
	    if (parse_value() == ERROR) return ERROR;
	    if (savedval->type != STRING) return ERROR;
	    add_property(obj, savedval->val.sval, rval);
	    free(savedval); // we need to free this.. the string is freed later
	} while (_parse_comma() == COMMA_VALUE);
	finalize_object(obj);
	rval = val;
	return _parse_eobj() == END_OBJECT ? OBJECT_VALUE : ERROR;
    }
    return ERROR;
}


int parse_string()
{
    JSONValue *val = create_value();
    char buf[128];
    int j = 0;

    _parse_white();
    if (_parse_quote() == QUOTE_VALUE) {
	while (_char_in_string())
	    buf[j++] = *_get_char();
	buf[j] = '\0';
	val->val.sval = strdup(buf);
	val->type = STRING;
	rval = val;
	return (_parse_quote() == QUOTE_VALUE) ? STRING_VALUE : ERROR;
    }
    return ERROR;
}


/*
 * This needs to expanded and tested for all possible number formats..
 * particularly fixed and floating pointing formats are not handled properly
 * or correctly...
 */
int parse_number()
{
    JSONValue *val = create_value();
    char buf[64];
    int j = 0;

    _parse_white();

    while (isdigit(_parse_str[_loc]))
        buf[j++] = *(_get_char());

    if (_parse_str[_loc] == '.') {
        buf[j++] = *(_get_char());
        while (isdigit(_parse_str[_loc]))
            buf[j++] = *(_get_char());
        buf[j] = '\0';
        val->val.dval = atof(buf);
        val->type = DOUBLE;
        rval = val;
        return NUMBER_VALUE;
    } else {
        buf[j] = '\0';
        val->val.ival = atoi(buf);
        val->type = INTEGER;
        rval = val;
        return NUMBER_VALUE;
    }
}


/*
 * Private functions...
 */

int _peek_value()
{
    return _parse_str[_loc];
}


void _consume_char()
{
    _loc++;
}


void _parse_white()
{
    while (_loc < _len && _parse_str[_loc] == ' ')
        _loc++;
}


int _parse_colon()
{
    _parse_white();
    if (_parse_str[_loc++] == ':')
        return COLON_VALUE;
    else {
        _loc--;
        return ERROR;
    }
}


int _parse_comma()
{
    _parse_white();
    if (_parse_str[_loc++] == ',')
        return COMMA_VALUE;
    else {
        _loc--;
        return ERROR;
    }
}


int _parse_barr()
{
    _parse_white();
    if (_parse_str[_loc++] == '[')
        return BEGIN_ARRAY;
    else {
        _loc--;
        return ERROR;
    }
}


int _parse_earr()
{
    _parse_white();
    if (_parse_str[_loc++] == ']')
        return END_ARRAY;
    else {
        _loc--;
        return ERROR;
    }
}


int _parse_bobj()
{
    _parse_white();
    if (_parse_str[_loc++] == '{')
        return BEGIN_OBJECT;
    else {
        _loc--;
        return ERROR;
    }
}


int _parse_eobj()
{
    _parse_white();
    if (_parse_str[_loc++] == '}')
        return END_OBJECT;
    else {
        _loc--;
        return ERROR;
    }
}

int _parse_quote()
{
    _parse_white();
    if (_parse_str[_loc++] == '"')
        return QUOTE_VALUE;
    else {
        _loc--;
        return ERROR;
    }
}


int _char_in_string()
{
    int curchar = _parse_str[_loc];

    if (isalnum(curchar) || curchar == '-' || curchar == '.' || curchar == '_' || curchar == '*' ||
        curchar == '$' || curchar == '@' || curchar == '#' || curchar == '$' ||  curchar == '%' ||
        curchar == '&' || curchar == '(' || curchar == ')' || curchar == '=' || curchar == '+' ||
        curchar == '[' || curchar == ']' || curchar == '|')
        return 1;
    else
        return 0;
}


char *_get_char()
{
    return &(_parse_str[_loc++]);
}
