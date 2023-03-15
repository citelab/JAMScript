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
#include "esp_heap_caps.h"



tboard_t _global_tboard;

// This is a totally random guess
#define TLSTORE_TASK_PTR_IDX 0 

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

function_t* tboard_find_func(tboard_t* tboard, const char* symbol)
{
    assert(tboard != NULL);

    //printf("Looking for a symbol %s\n", symbol);


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

// This might be overcomplicating things if this is just an array of pointers.....

// TODO: this makes no sense rewrite. 
uint32_t _tboard_get_next_task_index(tboard_t* tboard)
{
    if(!tboard->num_dead_tasks)
    {
        //TODO: double check
        assert(tboard->num_tasks+1 < MAX_TASKS);

        assert(xSemaphoreTake(tboard->task_management_mutex, MAX_SEMAPHORE_WAIT) == pdTRUE);
        int indx = tboard->num_tasks++;
        xSemaphoreGive(tboard->task_management_mutex);

        return indx;
    }

    for(int i = tboard->last_dead_task; i < tboard->num_tasks; i++)
    {
        if(tboard->tasks[i] == NULL)
        {
            assert(xSemaphoreTake(tboard->task_management_mutex, MAX_SEMAPHORE_WAIT) == pdTRUE);
            if(tboard->tasks[i] != NULL)
                continue;

            tboard->last_dead_task = i+1;
            tboard->num_dead_tasks--;

            xSemaphoreGive(tboard->task_management_mutex);
            return i;
        }
    }

    //printf("Task list state invalid...\n");
    assert(0 && "Corrupted task array.");

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
    arg_t* return_arg = NULL;
    execution_context_t ctx;
    ctx.query_args = task->query_args;
    ctx.return_arg = &return_arg;

    //printf("Heap size left: %u\n\n", heap_caps_get_free_size(MALLOC_CAP_8BIT) );

    vTaskSetThreadLocalStoragePointer( NULL,  
                                       TLSTORE_TASK_PTR_IDX,     
                                       param );


    task->function->entry_point(&ctx);

    if(return_arg != NULL && task->return_hook)
    {    
        command_t* res_cmd = command_new_using_arg(CmdNames_REXEC_RES, 
                                                    0, 
                                                    task->function->symbol, 
                                                    task->task_id, 
                                                    get_device_cnode()->node_id, 
                                                    task->function->arg_signature, 
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

task_t* task_create(tboard_t *tboard, function_t* function, arg_t* query_args)
{
    task_t* task = (task_t*) calloc(1, sizeof(task_t));

    task->index = _tboard_get_next_task_index(tboard);
    tboard->tasks[task->index] = task;

    task->task_id = mysnowflake_id();

    task->function = function;
    task->query_args = command_args_clone(query_args);

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


task_t* task_create_from_remote(tboard_t* tboard, function_t* function, uint64_t task_id, arg_t* query_args, bool return_hook)
{
    task_t* task = (task_t*) calloc(1, sizeof(task_t));
    task->index = _tboard_get_next_task_index(tboard);
    tboard->tasks[task->index] = task;

    task->task_id = task_id;
    
    task->function = function;
    task->query_args = command_args_clone(query_args);

    //TODO: disable this if return val is not used
    task->return_hook = return_hook;

    int core = 1;
    if (function->task_type==SEC_BATCH_TASK)
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
    printf("Couldn't find remote task with id %llu\n", task_id);
    assert(0 && "Couldn't find task with id");
    return NULL;
}

void task_destroy(tboard_t *tboard, task_t* task)
{
    assert(xSemaphoreTake(tboard->task_management_mutex, MAX_SEMAPHORE_WAIT) == pdTRUE);

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

// TODO: consider defining my own compact array definition.... to avoid all the copy paste
// TODO: maybe rename to make it clear that this also kind of allocates the task
uint32_t _tboard_alloc_next_remote_task(tboard_t* tboard)
{
    if(!tboard->num_dead_remote_tasks)
    {
        assert(tboard->num_remote_tasks+1 < MAX_TASKS );

        assert(xSemaphoreTake(tboard->remote_task_management_mutex, MAX_SEMAPHORE_WAIT) == pdTRUE);
        int indx = tboard->num_remote_tasks++;
        xSemaphoreGive(tboard->remote_task_management_mutex);

        return indx;
    }

    for(int i = tboard->last_dead_remote_task; i < tboard->num_remote_tasks; i++)
    {
        if(tboard->remote_tasks[i].destroyed)
        {
            assert(xSemaphoreTake(tboard->remote_task_management_mutex, MAX_SEMAPHORE_WAIT) == pdTRUE);
            if(!tboard->remote_tasks[i].destroyed)
                continue;

            // next search should start at the next index after this
            tboard->last_dead_remote_task = i+1;
            tboard->num_dead_remote_tasks--;
            xSemaphoreGive(tboard->remote_task_management_mutex);

            return i;
        }
    }

    assert(0 && "Corrupted remote task array.");
    
    return 0;
}

// TODO: Double check for copy errors
void remote_task_destroy(tboard_t *tboard, remote_task_t* rtask)
{
    assert(xSemaphoreTake(tboard->remote_task_management_mutex, MAX_SEMAPHORE_WAIT) == pdTRUE);

    tboard->remote_tasks[rtask->index].destroyed = true;

    if(tboard->last_dead_remote_task > rtask->index || tboard->num_dead_remote_tasks == 0)
        tboard->last_dead_remote_task = rtask->index;
    
    tboard->num_dead_remote_tasks++;
    xSemaphoreGive(tboard->remote_task_management_mutex);
}

remote_task_t* tboard_find_remote_task(tboard_t* tboard, uint64_t task_id)
{
    for(int i = 0; i < tboard->num_remote_tasks; i++)
    {
        remote_task_t* indx = &tboard->remote_tasks[i];
        if(indx->destroyed)
            continue;

        if(indx->task_id==task_id)
        {
            return indx;
        }
    }
    printf("Couldn't find remote task with id %llu\n", task_id);
    assert(0 && "Couldn't find remote task with id");
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
    
    return JAM_OK;
}

jam_error_t remote_command_disaptch(tboard_t* tboard, command_t* command)
{

    // Dispatch REXEC
    assert(command->length <= MAX_COMMAND_SIZE);
    multicast_copy_send(tboard->dispatcher, command->buffer, command->length);
    printf("\nSending tasks.\n\n");
    return JAM_OK;
}

// @Unimplemented
arg_t* remote_task_start_sync(tboard_t* tboard, char* symbol, int32_t level,
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
    rtask_builder.timeout = 10; //This is a default as there is

    // Store record of remote task
    rtask_builder.index = _tboard_alloc_next_remote_task(tboard);

    remote_task_t* rtask = tboard->remote_tasks + rtask_builder.index;
    *rtask = rtask_builder;

    remote_command_disaptch(tboard, command);

    command_free(command);

    uint32_t notification = 0;
    int response;
    bool got_ack = 0;
    bool sent_get_rexec_res = 0;
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
            sent_get_rexec_res = true;
            got_ack = false; // Wait for either deadline extension or response
        }
        
    }
    
    arg_t* rargs = rtask->return_arg;
    remote_task_destroy(tboard, rtask);
    
    return rargs;
}

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
