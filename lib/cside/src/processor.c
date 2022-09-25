#include "tboard.h"
#include "processor.h"
#include "queue/queue.h"
#include <pthread.h>
#include <stdlib.h>
#include <minicoro.h>
#include "command.h"
#include "constants.h"
#include "cnode.h"
#include "tboard.h"


arg_t *command_arg_clone_special(arg_t *arg, char *fname, long int taskid, char *nodeid, void *serv) 
{   
    arg_t *rl;
    int i = 0;
    printf("========== Node id %s\n", nodeid);
    if (arg == NULL) {
        rl = (arg_t *)calloc(4, sizeof(arg_t));
        rl[i].type = STRING_TYPE;
        rl[i].val.sval = strdup(fname);
        rl[i].nargs = 4;
        i++;
        rl[i].type = LONG_TYPE;
        rl[i].val.lval = taskid;
        rl[i].nargs = 4;
        i++;
        rl[i].type = STRING_TYPE;
        rl[i].val.sval = strdup(nodeid);
        rl[i].nargs = 4;
        i++;
        rl[i].type = VOID_TYPE;
        rl[i].val.vval = serv;
        rl[i].nargs = 4;
    } else {
        rl = (arg_t *)calloc(arg->nargs + 4, sizeof(arg_t));
        for(i = 0; i < arg->nargs; i++) {
            rl[i] = arg[i];
            rl[i].nargs = arg->nargs + 4;
        }
        rl[i].type = STRING_TYPE;
        rl[i].val.sval = strdup(fname);
        rl[i].nargs = arg->nargs + 4;
        i++;
        rl[i].type = LONG_TYPE;
        rl[i].val.lval = taskid;
        rl[i].nargs = arg->nargs + 4;
        i++;
        rl[i].type = STRING_TYPE;
        rl[i].val.sval = strdup(nodeid);
        rl[i].nargs = arg->nargs + 4;
        i++;
        rl[i].type = VOID_TYPE;
        rl[i].val.vval = serv;
        rl[i].nargs = arg->nargs + 2;
    }
    return rl;
}


void exec_sync(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    printf("Hi... in exec sync %d, type %d\n", t[0].nargs, t[0].type);
   // command_arg_free(t);
    int nargs = t->nargs;
    char *fn_name = t[nargs - 4].val.sval;
    long int task_id = t[nargs - 3].val.lval;
    char *node_id = strdup(t[nargs - 2].val.sval);
    server_t *s = (server_t *)t[nargs - 1].val.vval;
    cnode_t *c = s->cnode;
    tboard_t *tb = (tboard_t *)(c->tboard);
    function_t *f = tboard_find_func(tb, fn_name);
    if (f != NULL) {
        printf("Node ID ........%s\n", node_id);
        arg_t *rv = blocking_task_create(tb, *f, f->sideef, t, (nargs - 4));
        if (rv != NULL) {
            command_t *cmd;
            switch (rv->type)
            {
            case INT_TYPE:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, node_id, "i", rv->val.ival);
                break;
            case STRING_TYPE:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, node_id, "s", rv->val.sval);
                break;
            case DOUBLE_TYPE:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, node_id, "d", rv->val.dval);
                break;
            }
            mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
        }
    }
}

function_t esync = TBOARD_FUNC(exec_sync, "nnn", true);


void execute_cmd(server_t *s, function_t *f, command_t *cmd)
{
    cnode_t *c = s->cnode;
    tboard_t *t = (tboard_t *)(c->tboard);

    if (cmd->subcmd == 0)
        task_create(t, *f, cmd->args, cmd->nargs, cmd); // no return value
    else {
        printf("Node id %s\n", cmd->node_id);
        arg_t *a = command_arg_clone_special(cmd->args, cmd->fn_name, cmd->task_id, cmd->node_id, s);
        task_create(t, esync, a, a->nargs, NULL);
    }
}


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
        execute_cmd(s, f, cmd);
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

