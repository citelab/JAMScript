#include <stdarg.h>
#include "calls.h"
#include "tboard.h"
#include "core.h"
#include "jcond.h"
#include "mqtt-adapter.h"
#include "nvoid.h"

int compute_level(int cv) {
    return EDGE_LEVEL;
}

/*
 * Remote call that blocks for results. It returns NULL on failure.
 */
arg_t remote_sync_call(tboard_t* t, char* cmd_func, char* fn_sig, ...) {
    (void)t;
    // TODO: FIX THIS..
    int level = 0;

    arg_t* qargs = NULL;
    if (strlen(fn_sig) > 0) {
        va_list args;
        va_start(args, fn_sig);
        command_qargs_alloc(fn_sig, &qargs, args);
        va_end(args);
    }
    // TODO because we overwrite the qargs, there is probably a memory leak if the first argument is a string or nvoid (?) or do we do a command_args_internal_free();
    remote_task_create(t, cmd_func, level, fn_sig, qargs, strlen(fn_sig)); // This overwrites qargs

    arg_t retarg;
    retarg.type = qargs[0].type;
    retarg.val = qargs[0].val;

    free(qargs); // TODO check this isn;t causing memory leak... we should do an internal free before
    return retarg;
}

/*
 * An acknowledgement is required from the other side. We send the request
 * and expect a response to the request.
 */
bool remote_async_call(tboard_t* t, char* cmd_func, char* fn_sig, ...) {
    (void)t;
    int level = 0; //compute_level(condvec);

    arg_t* qargs = NULL;
    if (strlen(fn_sig) > 0) {
        va_list args;
        va_start(args, fn_sig);
        command_qargs_alloc(fn_sig, &qargs, args);
        va_end(args);
    }
    bool rval = remote_task_create_nb(t, cmd_func, level, fn_sig, qargs, strlen(fn_sig));
    command_args_free(qargs);
    return rval;
}

/*
 * This must be called from within a task.. not the main thread (outside the task)
 * On failure: this function returns NULL. Otherwise, it returns the pointer to retarg.
 */
arg_t local_sync_call(tboard_t* t, char* cmd_func, ...) {
    arg_t retarg = {};
    function_t* f = tboard_find_func(t, cmd_func);
    if (f != NULL) {
        const char* argsig = f->fn_sig;
        arg_t* qargs = NULL;
        if (strlen(argsig) > 0) {
            va_list args;
            va_start(args, cmd_func);
            command_qargs_alloc(argsig, &qargs, args);
            va_end(args);
        }
        arg_t retarg;
        blocking_task_create(t, *f, f->tasktype, &retarg, qargs, strlen(argsig));
        command_args_free(qargs);
    } else
        printf("ERROR! Function %s not available for execution\n", cmd_func);
    return retarg;
}

void local_async_call(tboard_t* t, char* cmd_func, ...) {
    function_t* f = tboard_find_func(t, cmd_func);
    if (f == NULL) {
        printf("ERROR! Function %s not available for execution\n", cmd_func);
        return;
    }

    if (jcond_evaluate(f->cond)) {
        const char* argsig = f->fn_sig;
        arg_t* qargs = NULL;
        if (strlen(argsig) > 0) {
            va_list args;
            va_start(args, cmd_func);
            command_qargs_alloc(argsig, &qargs, args);
            va_end(args);
        }
        task_create(t, *f, qargs, NULL);
        command_args_free(qargs);
    }
}
