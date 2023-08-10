#ifndef __CALLS_H__
#define __CALLS_H__

#include "tboard.h"
#include "command.h"


arg_t* remote_sync_call(tboard_t *t, char* cmd_func, arg_t* retarg, nvoid_t* retbuf, char* fn_sig, ...);
bool remote_async_call(tboard_t *t, char* cmd_func, char* fn_sig, ...);
arg_t* local_sync_call(tboard_t* t, char* cmd_func, arg_t* retarg, nvoid_t* retbuf, ...);
void local_async_call(tboard_t* t, char* cmd_func, ...);

#endif
