#include <stdarg.h>
#include "calls.h"
#include "tboard.h"
#include "core.h"
#include "mqtt_adapter.h"

int compute_level(int cv)
{
    return EDGE_LEVEL;
}

/*
 * Remote call that blocks for results. It returns NULL on failure.
 */
arg_t *remote_sync_call(tboard_t *t, char *cmd_func, char *condstr, int condvec, char *fn_sig, ...)
{
    va_list args;
    bool res;
    arg_t *qargs = NULL;
    arg_t *rarg = NULL;

    (void)t;
    int level = compute_level(condvec);

    if (strlen(fn_sig) > 0)
    {
        va_start(args, fn_sig);
        res = command_qargs_alloc(fn_sig, &qargs, args);
        va_end(args);

        if (res)
            rarg = remote_sync_task_create(t, cmd_func, condstr, condvec, level, fn_sig, qargs, strlen(fn_sig));
        else
            rarg = NULL;
    }
    else
        rarg = remote_sync_task_create(t, cmd_func, condstr, condvec, level, "", NULL, 0);
    return rarg;
}

/*
 * An acknowledgement is required from the other side. We send the request
 * and expect a response to the request.
 */
bool remote_async_call(tboard_t *t, char *cmd_func, char *condstr, int condvec, char *fn_sig, ...)
{
    va_list args;
    bool res;
    arg_t *qargs = NULL;

    (void)t;
    int level = compute_level(condvec);

    if (strlen(fn_sig) > 0)
    {
        va_start(args, fn_sig);
        res = command_qargs_alloc(fn_sig, &qargs, args);
        va_end(args);
        if (res)
            return remote_async_task_create(t, cmd_func, condstr, condvec, level, fn_sig, qargs, strlen(fn_sig));
        else
            return false;
    }
    else
        return remote_async_task_create(t, cmd_func, condstr, condvec, level, "", NULL, 0);
}

/*
 * This must be called from within a task.. not the main thread (outside the task)
 * On failure: this function returns NULL. Otherwise, it returns a pointer to an arg_t.
 */
void *local_sync_call(tboard_t *t, char *cmd_func, ...)
{
    va_list args;
    bool res;
    arg_t *qargs;

    function_t *f = tboard_find_func(t, cmd_func);
    if (f == NULL)
    {
        printf("ERROR! Function %s not available for execution\n", cmd_func);
        return NULL;
    }
    const char *fmask = f->fn_sig;
    if (strlen(fmask) > 0)
    {
        va_start(args, cmd_func);
        res = command_qargs_alloc(fmask, &qargs, args);
        va_end(args);
        return blocking_task_create(t, *f, f->sideef, qargs, strlen(fmask));
    }
    else
        return blocking_task_create(t, *f, f->sideef, NULL, 0);
}

void local_async_call(tboard_t *t, char *cmd_func, ...)
{
    va_list args;
    bool res;
    arg_t *qargs;

    function_t *f = tboard_find_func(t, cmd_func);
    if (f == NULL)
    {
        printf("ERROR! Function %s not available for execution\n", cmd_func);
        return;
    }
    const char *fmask = f->fn_sig;
    if (strlen(fmask) > 0)
    {
        va_start(args, cmd_func);
        res = command_qargs_alloc(fmask, &qargs, args);
        va_end(args);
        task_create(t, *f, qargs, strlen(fmask), NULL);
    }
    else
        task_create(t, *f, NULL, 0, NULL);
}