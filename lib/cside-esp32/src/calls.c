#include "calls.h"
#include "tboard.h"
#include <stdarg.h>

arg_t* remote_sync_call(tboard_t* tboard, char* symbol, char* arg_signature, ...)
{
    va_list args;
    bool res;

    arg_t* qargs = NULL;
    arg_t* rarg  = NULL;
    // TODO: figure out what level even does?
    // TODO: FIX THIS..
    int level = 0;

    if (strlen(arg_signature) > 0)
    {
        va_start(args, arg_signature);
        res = command_qargs_alloc(arg_signature, &qargs, args);
        va_end(args);

        if (res)
        {
            rarg = remote_task_start_sync(tboard, symbol, level, arg_signature,
                                          qargs, strlen(arg_signature));
        }
        else
            rarg = NULL;
    }
    else
        rarg = remote_task_start_sync(tboard, symbol, level, "", NULL, 0);
    return rarg;
}

bool remote_async_call(tboard_t* tboard, char* symbol, char* arg_signature, ...)
{
    va_list args;
    bool res;
    arg_t* qargs = NULL;

    int level = 0; // compute_level(condvec);

    if (strlen(arg_signature) > 0)
    {
        va_start(args, arg_signature);
        res = command_qargs_alloc(arg_signature, &qargs, args);
        va_end(args);
        if (res)
        {
            return remote_task_start_async(tboard, symbol, level, arg_signature,
                                           qargs, strlen(arg_signature));
        }
        else
            return false;
    }
    else
        return remote_task_start_async(tboard, symbol, level, "", NULL, 0);
}

void* local_sync_call(tboard_t* tboard, char* symbol, ...)
{
    assert(0 && "Unimplemented");
    return NULL;
}

void local_async_call(tboard_t* tboard, char* symbol, ...)
{
    assert(0 && "Unimplemented");
}