#ifndef __TASK_H__
#define __TASK_H__

#include "command.h"
#include "tboard.h"

typedef struct _tboard_t tboard_t;

typedef struct _task_t
{

} task_t;

typedef struct _task_t
{

} remote_task_t;


// @Unimplemented
arg_t* task_get_args(); 

// @Unimplemented
arg_t* remote_task_start_sync(struct _tboard_t* tboard, 
    char* symbol, 
    int32_t level, 
    char* arg_sig, 
    arg_t* args, 
    uint32_t size); 

arg_t* remote_task_start_async(struct _tboard_t* tboard, 
    char* symbol, 
    int32_t level, 
    char* arg_sig, 
    arg_t* args, 
    uint32_t size);


#endif
