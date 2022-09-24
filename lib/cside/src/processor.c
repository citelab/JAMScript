#include "tboard.h"
#include "processor.h"
#include "queue/queue.h"
#include <pthread.h>
#include <stdlib.h>
#include <minicoro.h>
#include "command.h"
#include "constants.h"
#include "cnode.h"


// TODO: consider adding function to add task_t task so we dont have to do this both here and task_create
bool msg_processor(void *serv, command_t *cmd)
{
    function_t *f;
    remote_task_t *rtask = NULL;
    server_t *s = (server_t *)serv;
    cnode_t *c = s->cnode;
    tboard_t *t = (tboard_t *)(c->tboard);
    // when a message is received, it interprets message and adds to respective queue
    switch (cmd->cmd)
    {
    case CmdNames_REXEC:
        // find the function
        printf("Looking for function %s\n", cmd->fn_name);
        f = tboard_find_func(t, cmd->fn_name);
        if (f == NULL)
        {
            send_err_msg(s, cmd->node_id, cmd->task_id);
            // send REXEC_ERR to the controller that sent the request
            command_free(cmd);
            return false;
        } else
            // send the REXEC_ACK to the controller that sent the request
            send_ack_msg(s, cmd->node_id, cmd->task_id, ((cmd->subcmd == 0) ? 0: globals_Timeout_REXEC_ACK_TIMEOUT));

        // cmd is freed after the task is completed.. otherwise we will create a memory fault
        printf("Creating task...  task-name %s, %d\n", f->fn_name, cmd->nargs);
        task_create(t, *f, cmd->args, cmd->nargs, cmd);
        return true;

    case CmdNames_REXEC_RES:
        // find the task
        HASH_FIND_INT(t->task_table, &(cmd->task_id), rtask);
        if (rtask != NULL)
        {
            rtask->data = command_arg_clone(cmd->args);
            rtask->data_size = 1;
            if (rtask->calling_task != NULL)
            {
                rtask->status = TASK_COMPLETED;
                assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
                // place parent task back to appropriate queue
                task_place(t, rtask->calling_task);
            }
        }
        else
            printf("Not found the task entry.. \n");
        command_free(cmd);
        return true;

    case CmdNames_PUT_SCHEDULE: // unimplemented in current milestones
                                // if (msg->subtype == PRIMARY_EXEC) {
                                // } else {
        tboard_err("msg_processor: Secondary scheduler unimplemented.\n");
        return false;
        // }
    default:
        //     tboard_err("msg_processor: Invalid message type encountered: %d\n", msg->type);
        return false;
    }
}

bool data_processor(tboard_t *t, msg_t *msg)
{
    // when data is received, it interprets message and proceeds accordingly (missing requirements)
    (void)t;
    (void)msg;
    tboard_err("data_processor: Data Processor unimplemented.\n");
    return false;
}

void send_err_msg(void *serv, char *node_id, long int task_id)
{
    server_t *s = (server_t *)serv;
    cnode_t *c = s->cnode;
    command_t *cmd = command_new(CmdNames_REXEC_ERR, 0, "", task_id, node_id, "i", CmdNames_FUNC_NOT_FOUND);
    mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
}

void send_ack_msg(void *serv, char *node_id, long int task_id, int timeout)
{
    server_t *s = (server_t *)serv;
    cnode_t *c = s->cnode;
    command_t *cmd = command_new(CmdNames_REXEC_ACK, 0, "", task_id, node_id, "i", timeout);
    mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
}

