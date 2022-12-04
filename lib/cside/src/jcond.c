#include "jcond.h"
#include <mujs.h>
#include <stdio.h>
#include <string.h>

js_State *J = NULL;
condition_t *jcondtbl = NULL;

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

void jcond_eval_str(const char *s)
{
    js_dostring(J, s);
}


// This is useful for evaluating a string that
// returns a return value. Like a function
char *jcond_eval_str_str(const char *s)
{
    char *res;

    char buf[strlen(s) + 32];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = strdup((char *)js_tostring(J, -1));
    js_pop(J, 1);

    return res;
}

int jcond_eval_bool(const char *s)
{
    int res;
    char buf[strlen(s) + 32];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = js_toboolean(J, -1);
    js_pop(J, 1);

    return res;
}

int jcond_eval_int(const char *s)
{
    int res;

    char buf[strlen(s) + 32];
    sprintf(buf, "var __jrval = eval(%s)", s);
    js_dostring(J, buf);
    js_getglobal(J, "__jrval");
    res = js_toint32(J, -1);
    js_pop(J, 1);

    return res;
}

double jcond_eval_double(const char *s)
{
    double res;

    char buf[strlen(s) + 32];
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

bool jcond_evaluate(const char *cnd)
{
    condition_t *c;
    if (strlen(cnd) == 0)
        return true;
    HASH_FIND_STR(jcondtbl, cnd, c);
    // if cnd not found - this is an error - return false
    if (c) 
        return jcond_eval_bool(c->cond);
    else
        return false;
}

void jcond_define(const char *label, const char *cstr)
{
    condition_t *centry = (condition_t *)malloc(sizeof(condition_t));
    centry->cond_name = strdup(label);
    centry->cond = strdup(cstr);
    HASH_ADD_STR(jcondtbl, cond_name, centry);
}
