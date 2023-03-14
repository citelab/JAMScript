#include <processor.h>
#include <cnode.h>
#include <task.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <constants.h>

void execute_cmd(tboard_t* tboard, function_t* f, command_t* cmd)
{
    if (cmd->subcmd == 0)
        task_create(tboard, f, cmd->args); // no return value
    else {
        assert(0 && "UNIMPLEMENTED");

        //arg_t *a = command_arg_clone_special(cmd->args, cmd->fn_name, cmd->task_id, cmd->node_id, s);
        // TODO: maybe replace task allocation with a fixed size buffer and queue
        // commands when buffer reaches capacity
        //task_create(tboard, esync, a);
    }
}
#define TEMP_ID 12
void process_message(tboard_t* tboard, command_t* cmd)
{
    command_t *rcmd;
    cnode_t* cnode = get_device_cnode();
    remote_task_t* rtask;
    switch(cmd->cmd)
    {
    case CmdNames_PING:
        rcmd = command_new(CmdNames_PONG, 0, "", 0, TEMP_ID, "");
        //multicast_copy_send(multicast, rmd->buffer, rcmd->length);

        printf("Received ping!\n");
        
        command_free(rcmd);
        //TODO: implement return ping send
        return;
    case CmdNames_REXEC:
        function_t* func = tboard_find_func(tboard, cmd->fn_name);
        if(func==NULL)
        {
            printf("Couldn't find function '%s'\n", cmd->fn_name);
            //TODO: send error response
            return;
        }
        execute_cmd(tboard, func, cmd);
        return;
    case CmdNames_REXEC_ACK:
        rtask = tboard_find_remote_task(tboard, cmd->task_id);
        rtask->status = REMOTE_TASK_STATUS_ACKED;
        rtask->timeout = cmd->args[0].val.ival;

        // TODO: consider if this task notify really needs to be here.        
        xTaskNotify(rtask->parent_task->internal_handle,
                    RTASK_ACK_BITS,
                    eSetBits);
        printf("Acknowledgement \n");
        return;
    case CmdNames_REXEC_RES:
        rtask = tboard_find_remote_task(tboard, cmd->task_id);

        rtask->return_arg = command_args_clone(cmd->args);
        rtask->status = REMOTE_TASK_STATUS_COMPLETE;
        xTaskNotify(rtask->parent_task->internal_handle,
                    RTASK_RES_BITS,
                    eSetBits);

        printf("Finished rexec res\n");

        return;
    }   
}