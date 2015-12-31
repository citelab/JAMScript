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


Current Issues
Arrays can be inputted with values of different types
i.e [2, "test"]
This should be invalid

All "" are literal, no escape characters possible

'' do not parse
*/

#include "tparser.h"
#include "TOML.h"
#include "date_parser.c"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <ctype.h>

static char *_parse_str_t;
static int _loc_t;
static int _len_t;
static int _num_names_t;


/*
 * Global variable rval is set by the 'parse_' functions called here.
 * There is no need to manipulate that variable here.. we just need to pass
 * along to the next iteration..
 */
static TOMLValue *t_rval;


/*
 * Local function prototypes..
 */
void _consume_comment_t();


int _peek_value_t();
void _consume_char_t();
void _parse_white_t();
int _end_of_table_t();
int _char_in_name_t();
int _char_in_string_t();
int _parse_colon_t();
int _parse_quote_t();
int _parse_comma_t();
int _parse_eobj_t();
int _parse_bobj_t();
int _parse_equal_t();
int _parse_earr_t();
int _parse_barr_t();
char _get_char_t();


int isNumber(char c){
    return c >= '0' && c <= '9';
}

/*
 * Setup the parse process...
 */
void t_init_parse(char *str)
{
    _parse_str_t = str;
    _loc_t = 0;
    _len_t = strlen(str);
    _num_names_t = 0;
}


/*
 * Return a pointer to the global variable holding the parsed TOML value..
 */
TOMLValue *t_get_value()
{
    return t_rval;
}


/*
 * Parse the TOML document.. the outer most parse loop
 * This should output a TOMLObject defining the document
 *
 */
int t_parse_doc()
{
    int nextchar;
    TOMLValue *val = t_create_value();
    TOMLObject *oval = t_create_object();

    t_set_object(val, oval);

    // keep eating white spaces away..
    _parse_white_t();
    while ((nextchar = _peek_value_t()) != T_EOF_VALUE) {
        printf("\nNextchar %c\n", nextchar);
        switch(nextchar)
        {
            case '\n':
                // consume the new line.. just falling through here
            case '#':
                // consume a comment line...
                _consume_comment_t();
                break;
            case '[':
                printf("Table parsing..\n");
                // this should be a table.. parse the name
                if (t_parse_tname() != T_ERROR) {
                    TOMLName *n = t_rval->val.nval;
                    printf("Found table name... ");
                    t_print_value(t_rval);

                    if (t_parse_table() != T_ERROR) {
                        printf("Adding property to the table..");
                        t_print_value(val);
                        t_add_property(oval, n, t_rval);
                    } else{
                        return T_ERROR;
                    }
                } else
                    return T_ERROR;
                printf("\n Printing the value after table insertion...\n");
                t_print_value(val);
                break;
            default:
                printf("Default parsing..");
                if(t_parse_date() == T_ERROR){
                    if (t_parse_name() != T_ERROR) {
                        printf("Name found..");
                        TOMLName *n = t_rval->val.nval;
                        if (_parse_equal_t() != T_ERROR) {
                            printf("Equal found...");
                            if (t_parse_value() != T_ERROR) {
                                printf("Value found..");
                                t_add_property(oval, n, t_rval);
                            } else{
                                printf("TESTING \n");
                                return T_ERROR;
                            }
                        }else
                            return T_ERROR;
                    }else{
                        return T_ERROR;
                    }
                    }else{
                        TOMLName * n = t_create_name();
                        t_add_name(n, t_rval->val.dtval->name);
                        printf("Date found ...\n");
                        print_time(&t_rval->val.dtval->date);
                        t_add_property(oval, n , t_rval);
                }
        }
        // keep eating white spaces away..
        _parse_white_t();
    }
    printf("\n------------------------------\n\n");
    printf("FINAL VALUES \n");
    t_print_value(val);
    printf("\n==============================\n");
    t_rval = val;

    return T_VALID_VALUE;
}
//Parses a date string given string 
int t_parse_date(){
    //The Format is year-month-dayThour:minute:
    //1979-05-27T07:32:00-08:00
    int temp = 0;
    int i;
    int prev_loc = _loc_t;   
    TOMLValue * ret;
    TOMLDate * val = t_create_date();
    char * valid;
    char date[128];

    _parse_white_t();
    //So the main idea is to check if this is a date string
    //Parse a string name when we have dob = 1994-02-04

    for(i = 0; i < 30; i++){
        if(_parse_str_t[_loc_t + i] == '#'){ //if the line is mostly comment
            _loc_t = prev_loc;
            return T_ERROR;
        }
        else if(_parse_str_t[_loc_t + i] == ' ' || _parse_str_t[_loc_t + i] == '='){  //Stop parsing the name
            break;
        }
        else
            val->name[i] = _parse_str_t[_loc_t + i];
    }
    _loc_t += i; //increment _loc_t
    _parse_white_t();
    if(_parse_str_t[_loc_t] != '='){ //we'd have a problem if the next value wasn't =
        _loc_t = prev_loc;
        return T_ERROR;
    }
    _loc_t++;
    _parse_white_t();
    //Parse the next part of the string for the datetime parser
    for(i = 0; i < 128 && (_loc_t + i) < _len_t; i++){ //Get short form of the date (if it exists)
        date[i] = _parse_str_t[_loc_t + i];
        if(date[i] == '\n' || date[i] == '#' || date[i] == ' '){
            date[i] = '\0';//end of the string
            break;
        }
    }
    _loc_t += i;

    valid = parse_datetime(date, &val->date, val->dston);
    if(valid == NULL){
        _loc_t = prev_loc;  //this means we can't handle it so we let the other parser do the work
        return T_ERROR;
    }
    else{ //otherwise, change t_rval so it can be changed
        ret = t_create_value();
        ret->type = T_DATETIME;
        ret->val.dtval = val;
        t_rval = ret;
    
        return T_DATETIME;
    }

}   

int t_parse_tname()
{
    int i;
    char c;
    char namebuf[MAX_NAME_LEN];
    TOMLName *n = t_create_name();
    TOMLValue *val = t_create_value();
    t_set_name(val, n);

    if (_parse_barr_t() != T_ERROR) {
        if (t_parse_string() == T_STRING) {
            t_add_name(n, t_rval->val.sval);
            t_free_value(t_rval, 1);
            t_rval = val;
            return T_NAME;
        }
        do {
            i = 0;
            while (_char_in_name_t())
                namebuf[i++] = _get_char_t();
            namebuf[i] = 0;
            t_add_name(n, namebuf);
            c = _get_char_t();
            if ((c != '.') && (c != ']'))
                return T_ERROR;
            }
        while (c != ']');
        t_rval = val;
        return T_NAME;

    } else
        return T_ERROR;
}


/*
 * Return a TOMLValue structure with the given name.
 */
int t_parse_name()
{
    int i;
    char namebuf[MAX_NAME_LEN];
    TOMLValue *val = t_create_value();
    TOMLName *n = t_create_name();
    t_set_name(val, n);

    if (t_parse_string() == T_STRING) {
        // String found.. so we process it accordingly..
        t_add_name(n, t_rval->val.sval);
        t_free_value(t_rval, 1);
        t_rval = val;
        return T_NAME;
    } else {
        // Check for name..
        i = 0;
        while (_char_in_name_t())
            namebuf[i++] = _get_char_t();
        namebuf[i] = 0;
        t_add_name(n, namebuf);
        t_rval = val;
        return T_NAME;
    }
}


int t_parse_value()
{
    _parse_white_t();
    int nextchar = _peek_value_t();

    // Each match is tentative.. there is backtracking built into each matching
    // On failure, the pointer on the input stream is not advanced.
    //
    printf("\nTHE CHARACTER IS %c\n", nextchar);
    switch(nextchar)
	{
	case '#':
	    _consume_comment_t();
	    break;
	case 't':
	    return (t_parse_true() == T_ERROR) ? T_ERROR : T_VALID_VALUE;
	case 'f':
	    return (t_parse_false() == T_ERROR) ? T_ERROR : T_VALID_VALUE;
	case '[':
        printf("\n WHAT IS LIFE ERROR\n");
	    return (t_parse_array() == T_ERROR) ? T_ERROR : T_VALID_VALUE;
	case '"':
	    return (t_parse_string() == T_ERROR) ? T_ERROR : T_VALID_VALUE;
	case '-':
	    return (t_parse_number() == T_ERROR) ? T_ERROR : T_VALID_VALUE;
	default:
	    if ((nextchar >= '0') && (nextchar <= '9'))
		return (t_parse_number() == T_ERROR) ? T_ERROR : T_VALID_VALUE;
	}
    return T_ERROR;
}


int t_parse_table()
{
    TOMLValue *val = t_create_value();
    TOMLObject *tbl = t_create_object();
    t_set_object(val, tbl);

    // go processing the statements until EOF or '[' of a begin Table.
    while (!_end_of_table_t()) {
        printf("Cur. character %c .. loc %d Next: ", _peek_value_t(), _loc_t);
        t_print_value(t_rval);
        if(_peek_value_t() == '#')
            _consume_comment_t();
        else if(t_parse_date() != T_ERROR){
            TOMLName * n = t_create_name();
            t_add_name(n, t_rval->val.dtval->name);
            printf("Date found ...\n");
            print_time(&t_rval->val.dtval->date);
            t_add_property(tbl, n , t_rval);
        }
        else if (t_parse_name() != T_ERROR) {
            TOMLName *n = t_rval->val.nval;
            printf("\n Name found.......");
            t_print_value(t_rval);
            if (_parse_equal_t() != T_ERROR) {
                printf("\n Equal found.......");
                printf("TESTING");
                if (t_parse_value() != T_ERROR) {
                    printf("\n Value found ..");
                    t_add_property(tbl, n, t_rval);
                }
            } else{
                return T_ERROR;
            }
        }
        _parse_white_t();
        _consume_comment_t();
    }

    t_rval = val;
    return T_OBJECT;
}


int t_parse_array()
{
    TOMLValue *val = t_create_value();
    TOMLArray *arr = t_create_array();
    t_set_array(val, arr);
    if (_parse_barr_t() == '[') {

            _parse_white_t();
            _consume_comment_t();
            _parse_white_t();

        while (_peek_value_t() != ']') {

            if (t_parse_value() == T_ERROR) return T_ERROR;
    	    t_add_element(arr, t_rval);
            _parse_comma_t();
            _parse_white_t();
            _consume_comment_t();
            _parse_white_t();
        }
        t_finalize_array(arr);
        t_rval = val;
        return _parse_earr_t() == ']' ? T_ARRAY_VALUE : T_ERROR;
    }
    return T_ERROR;
}


int t_parse_string()
{
    TOMLValue *val = t_create_value();
    char buf[128];
    int j = 0;

    _parse_white_t();
    if (_parse_quote_t() == '"') {
        while (_char_in_string_t())
            buf[j++] = _get_char_t();
        buf[j] = '\0';
        val->val.sval = strdup(buf);
        val->type = T_STRING;
        t_rval = val;
        return (_parse_quote_t() == '"') ? T_STRING_VALUE : T_ERROR;
    }
    return T_ERROR;
}


/*
 * This needs to expanded and tested for all possible number formats..
 * particularly fixed and floating pointing formats are not handled properly
 * or correctly...
 */
int t_parse_number()
{
    TOMLValue *val = t_create_value();
    char buf[64];
    int j = 0;
    int negative = 1;

    _parse_white_t();  
    if(_parse_str_t[_loc_t] == '-'){ //Is a negative number        
        negative = -1;
        _loc_t++;
    }
    while (isdigit(_parse_str_t[_loc_t]))
        buf[j++] = _get_char_t();

    if (_parse_str_t[_loc_t] == '.') {
        buf[j++] = _get_char_t();
        while (isdigit(_parse_str_t[_loc_t]))
            buf[j++] = _get_char_t();
        buf[j] = '\0';
        val->val.dval = atof(buf) * negative;
        val->type = T_DOUBLE;
        t_rval = val;
        return T_NUMBER_VALUE;
    } else {
        buf[j] = '\0';
        val->val.ival = atoi(buf) * negative;
        val->type = T_INTEGER;
        t_rval = val;
        return T_NUMBER_VALUE;
    }
}



void print_string()
{
    printf("Parse string %s\n", &_parse_str_t[_loc_t]);
}

int t_parse_true()
{
    int sloc;
    TOMLValue *val = t_create_value();

    _parse_white_t();
    sloc = _loc_t;
    if ((_parse_str_t[_loc_t++] == 't') && (_parse_str_t[_loc_t++] == 'r') &&
        (_parse_str_t[_loc_t++] == 'u') && (_parse_str_t[_loc_t++] == 'e')) {
        t_set_true(val);
        t_rval = val;
        printf("True found\n");
        return T_TRUE_VALUE;
    } else {
        free(val);
        _loc_t = sloc;
        return T_ERROR;
    }
}


int t_parse_false()
{
    int sloc;
    TOMLValue *val = t_create_value();

    _parse_white_t();
    sloc = _loc_t;
    if ((_parse_str_t[_loc_t++] == 'f') && (_parse_str_t[_loc_t++] == 'a') &&
	    (_parse_str_t[_loc_t++] == 'l') && (_parse_str_t[_loc_t++] == 's') &&
	    (_parse_str_t[_loc_t++] == 'e')) {
        t_set_false(val);
        t_rval = val;
        printf("False found .");
        return T_FALSE_VALUE;
    } else {
        free(val);
        _loc_t = sloc;
        return T_ERROR;
    }
}


int parse_array()
{
    TOMLValue *val = t_create_value();
    TOMLArray *arr = t_create_array();
    t_set_array(val, arr);

    if (_parse_barr_t() == '[') {

        while (_peek_value_t() != ']') {
            if (t_parse_value() == T_ERROR) return T_ERROR;
    	    t_add_element(arr, t_rval);
            if (_peek_value_t() == ',')
                _parse_comma_t();
        }
        t_finalize_array(arr);
        t_rval = val;
        return _parse_earr_t() == ']' ? T_ARRAY_VALUE : T_ERROR;
    }
    return T_ERROR;
}

/*
 * Private functions...
 */

int _peek_value_t()
{
    if (_loc_t >= _len_t -1 )
        return T_EOF_VALUE;
    else
        return _parse_str_t[_loc_t];
}


void _consume_comment_t()
{
    // yes, it is comment.. start consuming!
    if (_parse_str_t[_loc_t] == '#') {
        while (_parse_str_t[_loc_t] != '\n')
            _loc_t++;
    }
    printf("Loc %d\n", _loc_t);
}

void _consume_char_t()
{
    _loc_t++;
}


void _parse_white_t()
{
    while (_loc_t < _len_t &&
          (_parse_str_t[_loc_t] == ' ' ||
           _parse_str_t[_loc_t] == '\n' ||
           _parse_str_t[_loc_t] == '\t' ))
        _loc_t++;
}


int _parse_equal_t()
{
    _parse_white_t();
    if (_parse_str_t[_loc_t++] == '=')
        return '=';
    else {
        _loc_t--;
        return T_ERROR;
    }
}


int _parse_barr_t()
{
    _parse_white_t();
    if (_parse_str_t[_loc_t++] == '[')
        return '[';
    else {
        _loc_t--;
        return T_ERROR;
    }
}


int _parse_earr_t()
{
    _parse_white_t();
    if (_parse_str_t[_loc_t++] == ']')
        return ']';
    else {
        _loc_t--;
        return T_ERROR;
    }
}


int _parse_quote_t()
{
    _parse_white_t();
    if (_parse_str_t[_loc_t++] == '"')
        return '"';
    else {
        _loc_t--;
        return T_ERROR;
    }
}


int _parse_comma_t()
{
    _parse_white_t();
    if (_parse_str_t[_loc_t++] == ',')
        return ',';
    else {
        _loc_t--;
        return T_ERROR;
    }
}

int _end_of_table_t()
{
    _parse_white_t();
    int curchar = _parse_str_t[_loc_t];

    if (curchar == '[' || _loc_t >= _len_t -1)
        return 1;
    else
        return 0;
}

int _char_in_name_t()
{
    int curchar = _parse_str_t[_loc_t];

    if (isalnum(curchar) || curchar == '_')
        return 1;
    else
        return 0;
}


int _char_in_string_t()
{
    int curchar = _parse_str_t[_loc_t];

    if (isalnum(curchar) || curchar == '-' || curchar == '.' || curchar == '_' || curchar == '*' ||
        curchar == '$' || curchar == '@' || curchar == '#' || curchar == '$' ||  curchar == '%' ||
        curchar == '&' || curchar == '(' || curchar == ')' || curchar == '=' || curchar == '+' ||
        curchar == '[' || curchar == ']' || curchar == '|' || curchar == ' ' || curchar == ',')
        return 1;
    else
        return 0;
}


char _get_char_t()
{
    return _parse_str_t[_loc_t++];
}
