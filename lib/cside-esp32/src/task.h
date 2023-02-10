#ifndef __TBOARD_H__
#define __TBOARD_H__

#include <stdint.h>
#include "command.h"
#include <stdbool.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// Perhaps all of this should just be put into the task.h file...

// This is low for now.. 
// TODO: consider option of generating this at compile time.
#define MAX_FUNCS 64 
#define MAX_TASKS 32

typedef struct _tboard_t tboard_t;
typedef struct _function_t function_t;

typedef struct _execution_context_t
{
    arg_t* query_args;
    arg_t* return_arg;
} execution_context_t;

void execution_context_return(execution_context_t* ctx, arg_t* return_arg);

typedef struct _task_t
{
    uint32_t id;
    uint32_t index;
    TaskHandle_t internal_handle; //@Refactor

    // Depending on how frequently this is accessed should maybe make it stored in struct.
    // TODO: refactor to func.
    function_t* function; 
    arg_t*  query_args;
    arg_t   return_arg;

    bool completed;

    volatile bool safe_to_delete;
    
} task_t;

typedef struct _remote_task_t
{
    bool destroyed;
} remote_task_t;


task_t* task_create(tboard_t* tboard, function_t* function, arg_t* args);
void    task_destroy(tboard_t* tboard, task_t* task);

arg_t*  task_get_args(task_t* task); 
void    task_set_return_arg(task_t* task, arg_t* return_arg);

// @Unimplemented
arg_t* remote_task_start_sync(tboard_t* tboard, 
    char* symbol, 
    int32_t level, 
    char* arg_sig, 
    arg_t* args, 
    uint32_t size); 

arg_t* remote_task_start_async(tboard_t* tboard, 
    char* symbol, 
    int32_t level,
    char* arg_sig, 
    arg_t* args, 
    uint32_t size);

typedef enum _task_type_t {
    PRI_SYNC_TASK   = 1,
    PRI_REAL_TASK   = 2,
    PRI_BATCH_TASK  = 3,
    SEC_BATCH_TASK  = 4
} task_type_t;


typedef void (*function_stub_t)(execution_context_t*);

struct _function_t
{
    const char*     symbol;    
    function_stub_t entry_point;
    task_type_t     task_type;
    const char*     arg_signature;
    const char*     condition;
};

#define TBOARD_FUNC(_symbol, _function, _arg_signature, _condition, _task_type)  \
    (function_t){.symbol = _symbol,                                          \
                 .entry_point = _function,                                   \
                 .arg_signature = _arg_signature,                            \
                 .condition = _condition,                                    \
                 .task_type = _task_type                                     \
                }

struct _tboard_t
{
    // TODO: add conditions.

    // TODO: Determine number of functions at compile time
    function_t* funcs[MAX_FUNCS];
    uint32_t    num_funcs;

    task_t*     tasks[MAX_TASKS];
    uint32_t    num_tasks;
    uint32_t    num_dead_tasks;
    uint32_t    last_dead_task;

    remote_task_t*  remote_tasks[MAX_TASKS];
    uint32_t        num_remote_tasks;
};

void        function_dump(function_t* func);

tboard_t*   tboard_create();
void        tboard_destroy();

void        tboard_register_func(tboard_t* tboard, function_t func);

void        tboard_dump_funcs(tboard_t* tboard);

function_t* tboard_find_func(tboard_t* tboard, const char* symbol);

uint32_t    _tboard_get_next_task_index(tboard_t* tboard);

#endif 