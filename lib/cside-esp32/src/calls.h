#ifndef __CALLS_H__
#define __CALLS_H__

#include "command.h"
#include "task.h"
#include "util.h"

#include <stdbool.h>

arg_t*  remote_sync_call(tboard_t* tboard, char* symbol, char* arg_sig, ...);
bool    remote_async_call(tboard_t* tboard, char* symbol, char* arg_sig, ...);
void*   local_sync_call(tboard_t* tboard, char* symbol, ...);
void    local_async_call(tboard_t* tboard, char* symbol, ...);

#endif