#include <processor.h>
#include <cnode.h>
#include <task.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <constants.h>
#include "endian.h"

static multicast_t* _processor_dispatcher;
static uint32_t _cached_packet_buffer_size;

static bool initialized = false;

// This is a temporary solution right now as we don't know node_id at init time.
void __temporary_dispatcher_init(command_t* cmd)
{
    if(initialized)
        return;
    initialized = true;

    command_t* ack_cmd = command_new(CmdNames_REXEC_ACK, 0, cmd->fn_name, cmd->task_id, cmd->node_id, "i", 20);
    memcpy(multicast_get_packet_buffer(_processor_dispatcher, NULL), 
           ack_cmd->buffer, ack_cmd->length);
    _cached_packet_buffer_size = ack_cmd->length;
    dump_bufer_hex_raw(ack_cmd->buffer, ack_cmd->length);
    command_free(ack_cmd);
}

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wstrict-aliasing"

#define COMMAND_OFFSET 1
#define ACK_TASKID_OFFSET 41
void send_ack(tboard_t* tboard, command_t* cmd, int duration)
{
    __temporary_dispatcher_init(cmd);
    double taskid = (double) cmd->task_id;
    uint64_t task_out = bswap64( *((uint64_t*) &(taskid)) );

    static int COMMAND = bswap32(CmdNames_REXEC_ACK);
    memcpy(multicast_get_packet_buffer(_processor_dispatcher, NULL)+COMMAND_OFFSET,
           &COMMAND, sizeof(int));

    memcpy(multicast_get_packet_buffer(_processor_dispatcher, NULL)+ACK_TASKID_OFFSET,
           &task_out, sizeof(double));

    multicast_send(_processor_dispatcher, _cached_packet_buffer_size);
}

#define ERR_TASKID_OFFSET 41
void send_err(tboard_t* tboard, command_t* cmd, int error)
{
    // The JAMScript error system isn't universally implemented yet.. currently skipping errors...
    return;

    //TODO: FINISH IMPLEMENTATION
    __temporary_dispatcher_init(cmd);
    double taskid = (double) cmd->task_id;
    uint64_t task_out = bswap64( *((uint64_t*) &(taskid)) );
    
    //void* temp = multicast_get_packet_buffer(_processor_dispatcher, NULL);

    static int COMMAND = bswap32(CmdNames_REXEC_ERR);
    memcpy(multicast_get_packet_buffer(_processor_dispatcher, NULL)+COMMAND_OFFSET,
           &COMMAND, sizeof(int));

    memcpy(multicast_get_packet_buffer(_processor_dispatcher, NULL)+ERR_TASKID_OFFSET,
           &task_out, sizeof(double));
    multicast_send(_processor_dispatcher, _cached_packet_buffer_size);
}
#pragma GCC diagnostic pop


void espcount();
void execute_cmd(tboard_t *tboard, function_t *f, command_t *cmd)
{
    // This is silly for now... We don't have a persistent device id so we take the 
    // generated device id from controller.
    if(get_device_cnode()->node_id==NULL)
        get_device_cnode()->node_id = strdup(cmd->node_id);

    // Ack
    send_ack(tboard, cmd, 20);

    // Queue Task
    task_create_from_remote(tboard, f, cmd->task_id, cmd->args, true); // no return value
    
    
}

void processor_init()
{
    _processor_dispatcher = multicast_create((ipv4_address_t){10,0,0,10}, 
                            Multicast_RECVPORTBUS, 
                            Multicast_SENDPORTBUS,
                            MAX_COMMAND_SIZE);
    printf("Processor initialized.\n");

}

void process_message(tboard_t *tboard, command_t *cmd)
{
    
    remote_task_t *rtask;
    switch (cmd->cmd)
    {
    case CmdNames_PING:
        assert(0 && "unimplemented");
        return;
    case CmdNames_REXEC:
        function_t *func = tboard_find_func(tboard, cmd->fn_name);
        if (func == NULL)
        {
            printf("Couldn't find function '%s'\n", cmd->fn_name);
            // TODO: Use Correct Error Code
            send_err(tboard, cmd, 0);
            return;
        }
        execute_cmd(tboard, func, cmd);
        return;
    case CmdNames_REXEC_ACK:
        rtask = tboard_find_remote_task(tboard, cmd->task_id);
        if(rtask==NULL)
        {
            // TODO: Use Correct Error Code
            send_err(tboard, cmd, 0);
            return;
        }
        rtask->status = REMOTE_TASK_STATUS_ACKED;
        rtask->timeout = cmd->args[0].val.ival;

        if(rtask->ignore_return)
        {
            remote_task_destroy(tboard, rtask);
            return;
        }
        // NOTE: Task notifications might not be the most efficient way of implementing this.
        xTaskNotify(rtask->parent_task->internal_handle,
                    RTASK_ACK_BITS,
                    eSetBits);
        printf("Acknowledgement \n");
        return;
    case CmdNames_REXEC_RES:
        rtask = tboard_find_remote_task(tboard, cmd->task_id); 
        // This is temporary for now!
        if(rtask==NULL)
        {
            // TODO: Use Correct Error Code
            send_err(tboard, cmd, 0);
            return;
        }

        rtask->return_arg = command_args_clone(cmd->args);
        rtask->status = REMOTE_TASK_STATUS_COMPLETE;

        if(rtask->ignore_return)
        {
            remote_task_destroy(tboard, rtask);
            return;
        }

        xTaskNotify(rtask->parent_task->internal_handle,
                    RTASK_RES_BITS,
                    eSetBits);

        printf("Finished rexec res\n");

        return;
    case CmdNames_GET_REXEC_RES:
        // For now, this is only going to be increasing the wait counter on the controller.
        printf("Requesting response\n");
        task_t* task = tboard_find_task(tboard, cmd->task_id);
        if(task==NULL)
        {
            // TODO: Use Correct Error Code
            send_err(tboard, cmd, 0);
            return;
        }
       
        send_ack(tboard, cmd, 20);
        return;
    default: 
        printf("Unknown Command! (%d)\n", cmd->cmd);
        return;
    }
}