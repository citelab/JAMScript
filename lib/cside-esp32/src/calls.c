#include "calls.h"
#include "task.h"
#include <stdarg.h>

arg_t* remote_sync_call(tboard_t* tboard, char* symbol, char* arg_signature, ...)
{
    va_list args;
    bool res;

    arg_t* qargs = NULL;
    arg_t* rarg  = NULL;
    
    if (strlen(arg_signature) > 0)
    {
        va_start(args, arg_signature);
        res = command_qargs_alloc(arg_signature, &qargs, args);
        va_end(args);

        assert(res!=NULL);

        if (res)
        {
            rarg = remote_task_start_sync(tboard, symbol, arg_signature,
                                          qargs, strlen(arg_signature));
        }
        else
            rarg = NULL; //TODO: This is an error state I believe..

    }
    else
        rarg = remote_task_start_sync(tboard, symbol, "", NULL, 0);
    return rarg;
}

bool remote_async_call(tboard_t* tboard, char* symbol, char* arg_signature, ...)
{
    va_list args;
    bool res;
    arg_t* qargs = NULL;

    if (strlen(arg_signature) > 0)
    {
        va_start(args, arg_signature);
        res = command_qargs_alloc(arg_signature, &qargs, args);
        va_end(args);

        assert(res!=NULL);

        if (res)
        {
            return remote_task_start_async(tboard, symbol, arg_signature,
                                           qargs, strlen(arg_signature));
        }
        else
            return false;
    }
    else
        return remote_task_start_async(tboard, symbol, "", NULL, 0);
}

void* local_sync_call(tboard_t* tboard, char* symbol, ...)
{
    va_list args;
    arg_t* query_args = NULL;
    arg_t* return_arg = calloc(1, sizeof(arg_t));

    function_t* func = tboard_find_func(tboard, symbol);
    if(func == NULL)
    {
        printf("Unable to find function '%s'.\n", symbol);
        return NULL;
    }

    va_start(args, symbol);
    command_qargs_alloc(func->arg_signature, &query_args, args);
    va_end(args);

    execution_context_t ctx;
    ctx.query_args = query_args;
    ctx.return_arg = return_arg;

    func->entry_point(&ctx);

    return return_arg;
}

void local_async_call(tboard_t* tboard, char* symbol, ...)
{
    va_list args;
    arg_t* qargs = NULL;



    function_t* func = tboard_find_func(tboard, symbol);
    if(func == NULL)
    {
        printf("Unable to find function '%s'.\n", symbol);
        return;
    }

    va_start(args, symbol);
    command_qargs_alloc(func->arg_signature, &qargs, args);
    va_end(args);

    task_create(tboard, func, qargs);

}