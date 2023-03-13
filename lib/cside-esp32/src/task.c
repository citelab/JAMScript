#include "task.h"
#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "constants.h"
#include "util.h"

tboard_t _global_tboard;

// Wait do we need this...
void function_dump(function_t* func)
{
    if(func == NULL)
    {
        printf("Function: Null\n");
        return;
    }
    printf("Function: symbol: '%s' entry_point 0x%08lx task_type: %d arg_sgnature: '%s' condition: '%s'\n",
           func->symbol,
           (uint32_t)func->entry_point,
           func->task_type,
           func->arg_signature,
           func->condition);
}

// This is a misleading name
tboard_t* tboard_create()
{
    tboard_t* tboard = &_global_tboard;
    memset(tboard, 0, sizeof(tboard_t));

    tboard->task_management_mutex = xSemaphoreCreateMutexStatic(&tboard->task_management_mutex_data);

    return tboard;
}

void tboard_destroy(tboard_t* tboard)
{
    assert(tboard != NULL);

    free(tboard);
}

function_t* tboard_find_func(tboard_t* tboard, const char* symbol)
{
    assert(tboard != NULL);

    printf("Looking for a symbol %s\n", symbol);


    // Should consider using a hash
    for (int i = 0; i < tboard->num_funcs; i++)
    {
        function_t *func = tboard->funcs[i];
        printf("Testing for a symbol %s\n", func->symbol);

        if (!strcmp(func->symbol, symbol))
        {
            return func;
        }
    }

    return NULL;
}

// This might be overcomplicating things if this is just an array of pointers.....
uint32_t _tboard_get_next_task_index(tboard_t* tboard)
{
    if(!tboard->num_dead_tasks)
    {
        //TODO: double check
        assert(tboard->num_tasks < MAX_TASKS);
        return tboard->num_tasks;
    }

    for(int i = tboard->last_dead_task; i < tboard->num_tasks; i++)
    {
        if(tboard->tasks[i] == NULL)
        {
            tboard->last_dead_task = i;
            tboard->num_dead_tasks--;
            return i;
        }
    }

    printf("Task list state invalid...\n");

    //TODO: double check
    assert(tboard->num_tasks < MAX_TASKS);
    tboard->num_dead_tasks = 0;
    return tboard->num_tasks;
}

void tboard_register_func(tboard_t* tboard, function_t func)
{
    assert(tboard != NULL);

    // Having this kind of indirection isn't ideal but as all function allocation happens at the same 
    // all function definitions should be allocated contiguously
    // if there was compile time information on number of functions, would be ideal.
    
    function_t** func_slot = tboard->funcs + tboard->num_funcs++;
    *func_slot = calloc(1, sizeof(function_t));

    **func_slot = func;
}


void tboard_dump_funcs(tboard_t* tboard)
{
    assert(tboard != NULL);

    for(int i = 0; i < tboard->num_funcs; i++)
    {
        function_dump(tboard->funcs[i]);
    }
}


/**
 * Task Definitions Here
*/


// @Unimplemented TODO: replace
uint32_t mysnowflake_id()
{
    static int counter = 0;
    counter            = (counter + 1) % 10000;
    uint32_t x;

    struct timeval tv_now;
    gettimeofday(&tv_now, NULL);

    x = (uint32_t)tv_now.tv_sec * 1000000L + (uint32_t)tv_now.tv_usec;

    return x + counter;
}

void _debug_print_command_cbor(command_t* command)
{
    dump_bufer_hex(command->buffer, command->length);
}

void _task_freertos_entrypoint_wrapper(void* param)
{
    task_t* task = (task_t*) param;

    execution_context_t ctx;
    ctx.query_args = task->query_args;
    ctx.return_arg = &task->return_arg;

    task->function->entry_point(&ctx);

    task->completed = true;
    vTaskDelete(0);
}

task_t* task_create(tboard_t *tboard, function_t* function, arg_t* query_args)
{
    task_t* task = (task_t*) calloc(1, sizeof(task_t));

    assert(xSemaphoreTake(tboard->task_management_mutex, 1000 * portTICK_PERIOD_MS) == pdTRUE);

    task->index = _tboard_get_next_task_index(tboard);
    tboard->tasks[task->index] = task;

    static uint32_t task_id_counter = 0;
    task->id = ++task_id_counter;

    xSemaphoreGive(tboard->task_management_mutex);

    task->function = function;
    task->query_args = query_args;

    int core = 1;
    if (function->task_type==SEC_BATCH_TASK)
        core = 0;

    xTaskCreatePinnedToCore(_task_freertos_entrypoint_wrapper, 
                            "UNUSED", 
                            STACK_SIZE, 
                            task, 
                            1,
                            &task->internal_handle, 
                            core);
    return task;
}

void task_destroy(tboard_t *tboard, task_t* task)
{
    tboard->tasks[task->index] = NULL;

        assert(xSemaphoreTake(tboard->task_management_mutex, 1000 * portTICK_PERIOD_MS) == pdTRUE);


    if(tboard->last_dead_task > task->index || tboard->num_dead_tasks == 0)
        tboard->last_dead_task = task->index;
    
    tboard->num_dead_tasks++;
    xSemaphoreGive(tboard->task_management_mutex);


    free(task);
}

void execution_context_return(execution_context_t* ctx, arg_t* return_arg)
{
    assert(ctx != NULL);
    assert(return_arg != NULL);
    assert(ctx->return_arg != NULL);

    *ctx->return_arg = *return_arg;
}

// @Unimplemented
arg_t* remote_task_start_sync(tboard_t* tboard, char* symbol, int32_t level,
                              char* arg_sig, arg_t* args, uint32_t size)
{
    printf("Task Start Remote Sync - called '%s'\n", symbol);

    command_t* command = command_new_using_arg(CmdNames_REXEC, 0, symbol,
                                               mysnowflake_id(),
                                               "temp_device_id", arg_sig, args);

    _debug_print_command_cbor(command);

    assert(0 && "Unimplemented");

    return calloc(1, sizeof(arg_t));
}

// @Unimplemented
arg_t* remote_task_start_async(tboard_t* tboard, char* symbol, int32_t level,
                               char* arg_sig, arg_t* args, uint32_t size)
{
    printf("Task Start Remote Async - called '%s'\n", symbol);

    command_t* command = command_new_using_arg(CmdNames_REXEC, 0, symbol,
                                               mysnowflake_id(),
                                               "temp_device_id", arg_sig, args);
	
    _debug_print_command_cbor(command);

    assert(0 && "Unimplemented");

    return calloc(1, sizeof(arg_t));
}
