#include "jcond.h"


duk_context *ctx = NULL;


void jcond_init_duktape()
{
    if(ctx != NULL)
        jcond_free_duktape(ctx);

    ctx = duk_create_heap_default();
}


void jcond_eval_string(char *s)
{
    duk_eval_string(ctx, s);
}

int jcond_eval_bool(char *stmt)
{
    duk_eval_string(ctx, stmt);
    int ret = duk_get_boolean(ctx, -1);
    return ret;
}

int jcond_eval_int(char *stmt)
{
    duk_eval_string(ctx, stmt);
    int ret = duk_get_int(ctx, -1);
    return ret;
}

double jcond_eval_double(char *stmt)
{
    duk_eval_string(ctx, stmt);
    double ret = duk_get_number(ctx, -1);
    return ret;
}


void jcond_free_duktape(duk_context *ctx)
{
    duk_destroy_heap(ctx);
}
