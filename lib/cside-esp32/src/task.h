#ifndef __TBOARD_H__
#define __TBOARD_H__

#include <stdint.h>
#include "command.h"
#include <stdbool.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "multicast.h"
#include "util.h"


// Perhaps all of this should just be put into the task.h file...

// This is low for now.. 
// NOTE: consider generating this at compile time based on jamscript program.
#define MAX_FUNCS 64 
#define MAX_TASKS 256
#define MAX_RTASKS 3072
#define RTASK_ALLOC_FAIL MAX_RTASKS+100

typedef struct _tboard_t tboard_t;
typedef struct _function_t function_t;

typedef struct _execution_context_t
{
    arg_t* query_args;
    arg_t** return_arg;
} execution_context_t;

void execution_context_return(execution_context_t* ctx, arg_t* return_arg);

typedef struct _task_t
{
    uint64_t task_id;
    uint32_t index;
    TaskHandle_t internal_handle; //@Refactor

    // Depending on how frequently this is accessed should maybe make it stored in struct.
    function_t* func; 
    arg_t*  query_args;

    bool completed;

    bool return_hook;

    volatile bool safe_to_delete;
    
} task_t;


#define REMOTE_TASK_STATUS_WAITING_ACK  1
#define REMOTE_TASK_STATUS_ACKED        2
#define REMOTE_TASK_STATUS_COMPLETE     3
#define REMOTE_TASK_STATUS_ERROR        4

// Record of task running on controller
typedef struct _remote_task_t
{
    int status;
    int index;
    arg_t*   return_arg;
    char*   symbol;
    uint64_t task_id;
    uint32_t timeout;
    task_t* parent_task;

    // Potentially replace this with a flag in the function to remove rtask lookup
    bool ignore_return;
    bool destroyed;
} remote_task_t;

void remote_task_destroy(tboard_t *tboard, remote_task_t* rtask);

task_t* task_create(tboard_t* tboard, function_t* func, arg_t* args);
task_t* task_create_from_remote(tboard_t* tboard, function_t* func, uint64_t task_id, arg_t* args, bool remote_hook);
void    task_destroy(tboard_t* tboard, task_t* task);
arg_t*  task_get_args(task_t* task); 
void    task_set_return_arg(task_t* task, arg_t* return_arg);

task_t* get_current_task();

// @Unimplemented
arg_t* remote_task_start_sync(tboard_t* tboard, 
    char* symbol, 
    char* arg_sig, 
    arg_t* args, 
    uint32_t size); 

jam_error_t remote_task_start_async(tboard_t* tboard, 
    char* symbol, 
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
    // NOTE: Should determine number of functions at compile time
    function_t* funcs[MAX_FUNCS];
    uint32_t    num_funcs;

    task_t*     tasks[MAX_TASKS];
    uint32_t    num_tasks;
    uint32_t    num_dead_tasks;
    uint32_t    last_dead_task;

    SemaphoreHandle_t task_management_mutex;
    StaticSemaphore_t task_management_mutex_data;

    // No indirection for faster iterations.
    remote_task_t   remote_tasks[MAX_RTASKS];
    uint32_t        num_remote_tasks;
    uint32_t        num_dead_remote_tasks;
    uint32_t        last_dead_remote_task; //rename to be clearer. Destroyed index search start.

    SemaphoreHandle_t remote_task_management_mutex;
    StaticSemaphore_t remote_task_management_mutex_data;

    multicast_t* dispatcher;

};

void        function_dump(function_t* func);

tboard_t*   tboard_create();
void        tboard_destroy();

void        tboard_register_func(tboard_t* tboard, function_t func);

void        tboard_dump_funcs(tboard_t* tboard);
remote_task_t*  tboard_find_remote_task(tboard_t* tboard, uint64_t task_id);
task_t*         tboard_find_task(tboard_t* tboard, uint64_t task_id);


function_t* tboard_find_func(tboard_t* tboard, const char* symbol);

uint32_t    _tboard_get_next_task_index(tboard_t* tboard);

#endif 