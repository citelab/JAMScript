#include "jcond.h"
#include <mujs.h>
#include <stdio.h>
#include <string.h>

js_State *J = NULL;

void print(js_State *J)
{
    const char *name = js_tostring(J, 1);
    printf("%s\n", name);
    js_pushundefined(J);
}


void jcond_init()
{
    J = js_newstate(NULL, NULL, JS_STRICT);

    js_newcfunction(J, print, "console_log", 1);
    js_setglobal(J, "console_log");


}

void jcond_eval_str(char *s)
{
    js_dostring(J, s);
}


// This is useful for evaluating a string that
// returns a return value. Like a function
char *jcond_eval_str_str(char *s)
{
    char *res;

    char buf[strlen(s) + 16];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = strdup((char *)js_tostring(J, -1));
    js_pop(J, 1);

    return res;
}

int jcond_eval_bool(char *s)
{
    int res;
    char buf[strlen(s) + 16];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = js_toboolean(J, -1);
    js_pop(J, 1);

    return res;
}

int jcond_eval_int(char *s)
{
    int res;

    char buf[strlen(s) + 16];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = js_toint32(J, -1);
    js_pop(J, 1);

    return res;
}

double jcond_eval_double(char *s)
{
    double res;

    char buf[strlen(s) + 16];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = js_tonumber(J, -1);
    js_pop(J, 1);

    return res;
}


void jcond_free()
{
    js_freestate(J);
}
