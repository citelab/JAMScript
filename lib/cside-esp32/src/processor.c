#include <processor.h>
#include <cnode.h>
#include <task.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <constants.h>

void send_ack(tboard_t* tboard, command_t* cmd, int duration)
{
    command_t* ack_cmd = command_new(CmdNames_REXEC_ACK, 0, cmd->fn_name, cmd->task_id, cmd->node_id, "i", duration);
        
    assert(ack_cmd->length <= MAX_COMMAND_SIZE);
    multicast_copy_send(tboard->dispatcher, ack_cmd->buffer, ack_cmd->length);
    command_free(ack_cmd); 
}

void execute_cmd(tboard_t *tboard, function_t *f, command_t *cmd)
{
    //This is silly
    if(get_device_cnode()->node_id==NULL)
        get_device_cnode()->node_id = strdup(cmd->node_id);

    // Ack
    send_ack(tboard, cmd, 20);

    // Queue Task
    task_t* task = task_create_from_remote(tboard, f, cmd->task_id, cmd->args, true); // no return value
    
}
#define TEMP_ID 12
void process_message(tboard_t *tboard, command_t *cmd)
{
    command_t *rcmd;
    cnode_t *cnode = get_device_cnode();
    remote_task_t *rtask;
    switch (cmd->cmd)
    {
    case CmdNames_PING:
        rcmd = command_new(CmdNames_PONG, 0, "", 0, TEMP_ID, "");
        // multicast_copy_send(multicast, rmd->buffer, rcmd->length);

        printf("Received ping!\n");

        command_free(rcmd);
        // TODO: implement return ping send
        return;
    case CmdNames_REXEC:
        function_t *func = tboard_find_func(tboard, cmd->fn_name);
        if (func == NULL)
        {
            printf("Couldn't find function '%s'\n", cmd->fn_name);
            // TODO: send error response
            return;
        }
        execute_cmd(tboard, func, cmd);
        return;
    case CmdNames_REXEC_ACK:
        rtask = tboard_find_remote_task(tboard, cmd->task_id);
        if(rtask==NULL)
            return;
        rtask->status = REMOTE_TASK_STATUS_ACKED;
        rtask->timeout = cmd->args[0].val.ival;

        if(rtask->ignore_return)
        {
            remote_task_destroy(tboard, rtask);
            return;
        }
        // TODO: consider if this task notify really needs to be here.
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
            return;
        }
        //assert(rtask!=NULL);
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
        printf("Requesting response\n");
        // TODO: check if task exists
        task_t* task = tboard_find_task(tboard, cmd->task_id);
        send_ack(tboard, cmd, 20);
        return;
    }
}