#include "tboard.h"
#include "processor.h"
#include "queue/queue.h"
#include <pthread.h>
#include <stdlib.h>
#include <minicoro.h>
#include "command.h"

// TODO: consider adding function to add task_t task so we dont have to do this both here and task_create
bool msg_processor(tboard_t *t, command_t *cmd)
{
    function_t *f;
    remote_task_t *rtask = NULL;
    // when a message is received, it interprets message and adds to respective queue
    switch (cmd->cmd) {
        case REXEC_ASYNC:
            // find the function
            f = tboard_find_func(t, cmd->fn_name);
            if (f == NULL) {
                command_free(cmd);
                return false;
            }
            // cmd is freed after the task is completed.. otherwise we will create a memory fault
            printf("Creating task... %d\n", cmd->nargs);
            task_create(t, *f, cmd->args, cmd->nargs, cmd);
            return true;

        case REXEC_RES:
            // find the task
            HASH_FIND_INT(t->task_table, &(cmd->task_id), rtask);
            if (rtask != NULL)  {
                rtask->data = command_arg_clone(cmd->args);
                rtask->data_size = 1;
                if (rtask->calling_task != NULL) {
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

        case SCHEDULE: // unimplemented in current milestones
           // if (msg->subtype == PRIMARY_EXEC) {
           //     return bid_processing(t, (bid_t *)(msg->data));
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
    (void)t; (void)msg;
    tboard_err("data_processor: Data Processor unimplemented.\n");
    return false;
}

bool bid_processing(tboard_t *t, bid_t *bid)
{ 
    // missing requirements
    (void)t; (void)bid;
    tboard_err("msg_processor: Primary scheduler unimplemented.\n");
    return false;
}