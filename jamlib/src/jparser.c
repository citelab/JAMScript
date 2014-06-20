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

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

static char *_parse_str;
static int _loc;
static int _len;


/*
 * Setup the parse process... 
 */
void init_parse(char *str)
{
    _parse_str = str;
    _loc = 0;
    _len = strlen(str);
}

void print_string()
{
    printf("Parse string %s\n", &_parse_str[_loc]);
}


int parse_begin_obj()
{
    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // check if the next char is '{' 
    if (_loc < _len && _parse_str[_loc] == '{') {
	_loc++;
	return 1;
    } else {
	_loc--;
	return 0;
    }
}

int parse_end_obj()
{
    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // check if the next char is '}' 
    if (_loc < _len && _parse_str[_loc] == '}') {
	_loc++;
	return 1;
    } else {
	_loc--;
	return 0;
    }
}

int parse_begin_arr()
{
    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // check if the next char is '[' 
    if (_loc < _len && _parse_str[_loc] == '[') {
	_loc++;
	return 1;
    } else {
	_loc--;
	return 0;
    }
}

int parse_end_arr()
{
    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // check if the next char is ']' 
    if (_loc < _len && _parse_str[_loc] == ']') {
	_loc++;
	return 1;
    } else {
	_loc--;
	return 0;
    }
}


int parse_colon()
{
    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // check if the next char is ':' 
    if (_loc < _len && _parse_str[_loc] == ':') {
	_loc++;
	return 1;
    } else {
	_loc--;
	return 0;
    }
}

int parse_comma()
{
    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // check if the next char is ',' 
    if (_loc < _len && _parse_str[_loc] == ',') {
	_loc++;
	return 1;
    } else {
	_loc--;
	return 0;
    }
}


int parse_string(char **str)
{
    char *beginstr;

    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    // look for begin quote
    if (_loc < _len && _parse_str[_loc] == '"') {
	_loc++;
	beginstr = &(_parse_str[_loc]);
	while (_loc < _len && _parse_str[_loc] != '"')
	    _loc++;
	if (_parse_str[_loc] == '"') {
	    _parse_str[_loc] = '\0';
	    _loc++;
	    *str = beginstr;
	    return 1;
	} else
	    return 0;
    }
    return 0;
}


int parse_int(int *val)
{
    char *begin;
    char buf[MAX_PBUF_SIZE];
    int l;

    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    begin = &_parse_str[_loc];
    l = 0;
    while (_loc < _len && (_parse_str[_loc] >= '0' && _parse_str[_loc] <= '9')) {
	_loc++;
	l++;
    }

    if (l > 0) {
	strncpy(buf, begin, l);
	buf[l] = '\0';
	*val = atoi(buf);
	return 1;
    } else {
	*val = 0;
	return 0;
    }

    return 0;
}


int parse_float(float *val)
{
    char *begin;
    char buf[MAX_PBUF_SIZE];
    int l;

    // eat white space
    while (_loc < _len && _parse_str[_loc] == ' ')
	_loc++;

    begin = &_parse_str[_loc];
    l = 0;
    while (_loc < _len && ((_parse_str[_loc] >= '0' && _parse_str[_loc] <= '9') || _parse_str[_loc] == '.')) {
	_loc++;
	l++;
    }

    if (l > 0) {
	strncpy(buf, begin, l);
	buf[l] = '\0';
	*val = atof(buf);
	return 1;
    } else {
	*val = 0;
	return 0;
    }

    return 0;
}
