#include "task.h"
#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "constants.h"
#include "util.h"
#include "multicast.h"
#include "cnode.h"


#define MUTEX_WAIT 500



tboard_t _global_tboard;

// This is a totally random guess
#define TLSTORE_TASK_PTR_IDX 0 

// This is a misleading name
tboard_t* tboard_create()
{
    tboard_t* tboard = &_global_tboard;
    memset(tboard, 0, sizeof(tboard_t));

    tboard->task_management_mutex = xSemaphoreCreateMutexStatic(&tboard->task_management_mutex_data);
    tboard->remote_task_management_mutex = xSemaphoreCreateMutexStatic(&tboard->remote_task_management_mutex_data);

    for(int i = 0; i < MAX_TASKS; i++)
        tboard->remote_tasks[i].destroyed = true;

    tboard->dispatcher = multicast_create(
                            (ipv4_address_t){10,0,0,10}, 
                            Multicast_RECVPORTBUS, 
                            Multicast_SENDPORTBUS,
                            MAX_COMMAND_SIZE);
    
    // Enable copy-send mutex.
    multicast_make_threadsafe(tboard->dispatcher);

    return tboard;
}

void tboard_destroy(tboard_t* tboard)
{
    assert(tboard != NULL);

    free(tboard);
}

// NOTE: current implementation of task storage isn't a true memory pool.
//       This makes this seem a little overcomplicated.
uint32_t _tboard_get_next_task_index(tboard_t* tboard)
{
    if(!tboard->num_dead_tasks)
    {
        assert(tboard->num_tasks+1 < MAX_TASKS && "Ran out of task allocation memory");

        assert(xSemaphoreTake(tboard->task_management_mutex, MUTEX_WAIT) == pdTRUE);
        int indx = tboard->num_tasks++;
        xSemaphoreGive(tboard->task_management_mutex);

        return indx;
    }

    for(int i = tboard->last_dead_task; i < tboard->num_tasks; i++)
    {
        if(tboard->tasks[i] == NULL)
        {
            assert(xSemaphoreTake(tboard->task_management_mutex, MUTEX_WAIT) == pdTRUE);
            if(tboard->tasks[i] != NULL)
                continue;

            tboard->last_dead_task = i+1;
            tboard->num_dead_tasks--;

            xSemaphoreGive(tboard->task_management_mutex);
            return i;
        }
    }

    assert(0 && "Corrupted task array.");

    return 0;
}

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

function_t* tboard_find_func(tboard_t* tboard, const char* symbol)
{
    assert(tboard != NULL);

    // Should consider using a hash
    for (int i = 0; i < tboard->num_funcs; i++)
    {
        function_t *func = tboard->funcs[i];

        if (!strcmp(func->symbol, symbol))
        {
            return func;
        }
    }

    return NULL;
}

void tboard_register_func(tboard_t* tboard, function_t func)
{
    assert(tboard != NULL);

    // NOTE: Having this kind of indirection isn't ideal but as all function allocation happens at the same 
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

// Eventually it would be useful to be able to encode the memory pool index into the task_id (snowflake)
// This would remove the need to perform a search when processing task-related commands.

// Generates Task IDs
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
    arg_t* return_arg = NULL;
    execution_context_t ctx;
    ctx.query_args = task->query_args;
    ctx.return_arg = &return_arg;

    vTaskSetThreadLocalStoragePointer( NULL,  
                                       TLSTORE_TASK_PTR_IDX,     
                                       param );


    task->func->entry_point(&ctx);

    if(return_arg != NULL && task->return_hook)
    {    
        command_t* res_cmd = command_new_using_arg(CmdNames_REXEC_RES, 
                                                    0, 
                                                    task->func->symbol, 
                                                    task->task_id, 
                                                    get_device_cnode()->node_id, 
                                                    task->func->arg_signature, 
                                                    return_arg);

        assert(res_cmd->length <= MAX_COMMAND_SIZE);
        
        multicast_copy_send(get_device_cnode()->tboard->dispatcher, 
                            res_cmd->buffer, 
                            res_cmd->length);
        command_free(res_cmd);
    }

    task->completed = true;

    if(return_arg != NULL)
        command_args_free(return_arg);
    task_destroy(get_device_cnode()->tboard, task);
    vTaskDelete(0);
}

task_t* task_create(tboard_t *tboard, function_t* func, arg_t* query_args)
{
    task_t* task = (task_t*) calloc(1, sizeof(task_t));

    task->index = _tboard_get_next_task_index(tboard);
    tboard->tasks[task->index] = task;

    task->task_id = mysnowflake_id();

    task->func = func;
    task->query_args = command_args_clone(query_args);

    int core = 1;
    if (func->task_type==SEC_BATCH_TASK)
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


task_t* task_create_from_remote(tboard_t* tboard, function_t* func, uint64_t task_id, arg_t* query_args, bool return_hook)
{
    task_t* task = (task_t*) calloc(1, sizeof(task_t));
    task->index = _tboard_get_next_task_index(tboard);
    tboard->tasks[task->index] = task;

    task->task_id = task_id;
    
    task->func = func;
    task->query_args = command_args_clone(query_args);

    task->return_hook = return_hook;

    int core = 1;
    if (func->task_type==SEC_BATCH_TASK)
    {
        printf("Warning: Starting Task on core 0\n");
        core = 0;
    }

    xTaskCreatePinnedToCore(_task_freertos_entrypoint_wrapper, 
                            "UNUSED", 
                            STACK_SIZE, 
                            task, 
                            1,
                            &task->internal_handle, 
                            core);
    return task;
}


task_t* tboard_find_task(tboard_t* tboard, uint64_t task_id)
{
    for(int i = 0; i < tboard->num_tasks; i++)
    {
        task_t* indx = tboard->tasks[i];
        if(indx==NULL)
            continue;

        if(indx->task_id==task_id)
        {
            return indx;
        }
    }
    printf("Couldn't find task with id %llu\n", task_id);
    assert(0 && "Couldn't find task with id");
    return NULL;
}

void task_destroy(tboard_t *tboard, task_t* task)
{
    assert(xSemaphoreTake(tboard->task_management_mutex, MUTEX_WAIT) == pdTRUE);

    tboard->tasks[task->index] = NULL;

    if(tboard->last_dead_task > task->index || tboard->num_dead_tasks == 0)
        tboard->last_dead_task = task->index;
    
    tboard->num_dead_tasks++;
    xSemaphoreGive(tboard->task_management_mutex);

    command_args_free(task->query_args);
    free(task);
}


task_t* get_current_task()
{
    return (task_t*) pvTaskGetThreadLocalStoragePointer(NULL, TLSTORE_TASK_PTR_IDX);
}

uint32_t _tboard_alloc_next_remote_task(tboard_t* tboard)
{
    assert(xSemaphoreTake(tboard->remote_task_management_mutex, MUTEX_WAIT) == pdTRUE);

    if(!tboard->num_dead_remote_tasks)
    {
        // At capacity (should maybe enable a flag?)
        if(tboard->num_remote_tasks >= MAX_RTASKS)
        {
            xSemaphoreGive(tboard->remote_task_management_mutex);
            return RTASK_ALLOC_FAIL;
        }

        int indx = tboard->num_remote_tasks++;
        xSemaphoreGive(tboard->remote_task_management_mutex);
        return indx;
    }

    for(int i = tboard->last_dead_remote_task; i < tboard->num_remote_tasks; i++)
    {
        if(tboard->remote_tasks[i].destroyed)
        {
            // next search should start at the next index after this
            tboard->last_dead_remote_task = i;
            tboard->num_dead_remote_tasks--;
            
            xSemaphoreGive(tboard->remote_task_management_mutex);
            return i;
        }
    }

    // printf("\nDead Remote taks: %d, Num Tasks: %d, Last dead Task %d\n\n", 
    //     (int) tboard->num_dead_remote_tasks, 
    //     (int) tboard->num_remote_tasks, 
    //     (int) tboard->last_dead_remote_task);

    assert(0 && "Corrupted remote task array.");
            xSemaphoreGive(tboard->remote_task_management_mutex);

    return 0;
}

void remote_task_destroy(tboard_t *tboard, remote_task_t* rtask)
{
    assert(xSemaphoreTakeRecursive(tboard->remote_task_management_mutex, MUTEX_WAIT) == pdTRUE);

    remote_task_t* live_task = tboard->remote_tasks + rtask->index;
    if(live_task->destroyed)
    {
        xSemaphoreGiveRecursive(tboard->remote_task_management_mutex);
        return;
    }

    live_task->destroyed = true;

    if(tboard->last_dead_remote_task > rtask->index || tboard->num_dead_remote_tasks == 0)
        tboard->last_dead_remote_task = rtask->index;
    
    tboard->num_dead_remote_tasks++;
    xSemaphoreGiveRecursive(tboard->remote_task_management_mutex);
}

// This becomes a major bottleneck when there is a heavy load. The snowflake generator modification proposed 
// above would be a good solution.
remote_task_t* tboard_find_remote_task(tboard_t* tboard, uint64_t task_id)
{
    assert(xSemaphoreTake(tboard->remote_task_management_mutex, MUTEX_WAIT) == pdTRUE);
    for(int i = 0; i < tboard->num_remote_tasks; i++)
    {
        remote_task_t* indx = &tboard->remote_tasks[i];
        if(indx->destroyed)
            continue;

        if(indx->task_id==task_id)
        {
            xSemaphoreGive(tboard->remote_task_management_mutex);
            return indx;
        }
    }
    printf("Couldn't find remote task with id %llu\n", task_id);
    xSemaphoreGive(tboard->remote_task_management_mutex);
    return NULL;
}

void execution_context_return(execution_context_t* ctx, arg_t* return_arg)
{
    assert(ctx != NULL);
    assert(return_arg != NULL);
    assert(ctx->return_arg != NULL);

    *ctx->return_arg = command_args_clone(return_arg);
}

jam_error_t remote_command_send_basic_command(tboard_t* tboard, remote_task_t* rtask, int cmd)
{
    command_t* command = command_new(cmd, 0, rtask->symbol, rtask->task_id, "UNUSED_FOR_NOW", "");

    assert(command->length <= MAX_COMMAND_SIZE);
    multicast_copy_send(tboard->dispatcher, command->buffer, command->length);
    
    command_free(command);
    
    return JAM_OK;
}

jam_error_t remote_command_disaptch(tboard_t* tboard, command_t* command)
{
    // Dispatch REXEC
    assert(command->length <= MAX_COMMAND_SIZE);
    multicast_copy_send(tboard->dispatcher, command->buffer, command->length);
    
    return JAM_OK;
}

// @Unimplemented
arg_t* remote_task_start_sync(tboard_t* tboard, char* symbol,
                              char* arg_sig, arg_t* args, uint32_t size)
{
    printf("Task Start Remote Sync - called '%s'\n", symbol);
    uint32_t task_id = mysnowflake_id();

    command_t* command = command_new_using_arg(CmdNames_REXEC, 0, symbol,
                                               task_id,
                                               "temp_device_id", arg_sig, args);

    remote_task_t rtask_builder = {0};
    rtask_builder.status = REMOTE_TASK_STATUS_WAITING_ACK;
    rtask_builder.parent_task = get_current_task();
    rtask_builder.task_id = task_id;
    rtask_builder.symbol = symbol;
    rtask_builder.timeout = 10; //This is a default 
    rtask_builder.ignore_return = false;
    rtask_builder.destroyed = false;

    // Store record of remote task
    rtask_builder.index = _tboard_alloc_next_remote_task(tboard);

    remote_task_t* rtask = tboard->remote_tasks + rtask_builder.index;
    *rtask = rtask_builder;

    remote_command_disaptch(tboard, command);

    command_free(command);

    uint32_t notification = 0;
    int response;
    bool got_ack = 0;
    while(1)
    {
        response = xTaskNotifyWait(RTASK_RES_BITS | RTASK_ACK_BITS, 
                                   RTASK_RES_BITS | RTASK_ACK_BITS,
                                   &notification,
                                   rtask->timeout*portTICK_PERIOD_MS);

        if(notification & RTASK_ACK_BITS)
            got_ack = true;

        if(notification & RTASK_RES_BITS)
            break;

        if(response == 0)
        {
            printf("Remote Task %llu running '%s' timed out!\n", rtask->task_id, rtask->symbol);
            if(!got_ack)
            {
                assert(0 && "Never received an acknowledgement");
            }

            remote_command_send_basic_command(tboard, rtask, CmdNames_GET_REXEC_RES);
            
            // Wait for either deadline extension or response
            got_ack = false; 
        }
        
    }
    
    arg_t* rargs = rtask->return_arg;
    remote_task_destroy(tboard, rtask);
    
    return rargs;
}

void remote_task_aggressive_cull(tboard_t* tboard)
{
    remote_task_t* rt;
    assert(xSemaphoreTakeRecursive(tboard->remote_task_management_mutex, MUTEX_WAIT)==pdTRUE);
    for(int i = 0; i < tboard->num_remote_tasks; i++)
    {
        rt = tboard->remote_tasks + i;

        if(rt->ignore_return && !rt->destroyed)
        {
            remote_task_destroy(tboard, rt);
        }
    }
    xSemaphoreGiveRecursive(tboard->remote_task_management_mutex);
}

jam_error_t remote_task_start_async(tboard_t* tboard, char* symbol,
                               char* arg_sig, arg_t* args, uint32_t size)
{
    uint32_t task_id = mysnowflake_id();

    command_t* command = command_new_using_arg(CmdNames_REXEC, 0, symbol,
                                               task_id,
                                               "temp_device_id", arg_sig, args);

    remote_task_t rtask_builder = {0};
    rtask_builder.status = REMOTE_TASK_STATUS_WAITING_ACK;
    rtask_builder.parent_task = get_current_task();
    rtask_builder.task_id = task_id;
    rtask_builder.symbol = symbol;
    rtask_builder.timeout = 10; //This is a default 
    rtask_builder.ignore_return = true;
    rtask_builder.destroyed = false;

    // Store record of remote task
    do
    {
        rtask_builder.index = _tboard_alloc_next_remote_task(tboard);
        if(rtask_builder.index==RTASK_ALLOC_FAIL)
        {
            printf("WARNING: No more space for additional remote tasks. Trying to free space\n");
            remote_task_aggressive_cull(tboard);
        }
    } while (rtask_builder.index==RTASK_ALLOC_FAIL);

    remote_task_t* rtask = tboard->remote_tasks + rtask_builder.index;
    *rtask = rtask_builder;

    remote_command_disaptch(tboard, command);

    command_free(command);

    return JAM_OK;
}
