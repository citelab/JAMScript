#include <processor.h>
#include <cnode.h>
#include <task.h>

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
    switch(cmd->cmd)
    {
    case CmdNames_PING:
        rcmd = command_new(CmdNames_PONG, 0, "", 0, TEMP_ID, "");
        //multicast_copy_send(multicast, rmd->buffer, rcmd->length);

        printf("Received ping!\n");
        
        command_free(rcmd);
        command_free(cmd);
        //TODO: implement return ping send
        return;
    case CmdNames_REXEC:
        function_t* func = tboard_find_func(tboard, cmd->fn_name);

        printf("got here\n");
        if(func==NULL)
        {
            printf("Couldn't find function '%s'\n", cmd->fn_name);
            //TODO: send error response
            return;
        }

        //TODO: send ack

        execute_cmd(tboard, func, cmd);
        return;
    }   
}