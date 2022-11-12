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
    int nargs = t->nargs;
    char *fn_name = t[nargs - 4].val.sval;
    long int task_id = t[nargs - 3].val.lval;
    char *node_id = strdup(t[nargs - 2].val.sval);
    server_t *s = (server_t *)t[nargs - 1].val.vval;
    cnode_t *c = s->cnode;
    tboard_t *tb = (tboard_t *)(c->tboard);
    function_t *f = tboard_find_func(tb, fn_name);
    if (f != NULL) {
        arg_t *rv = blocking_task_create(tb, *f, f->tasktype, t, (nargs - 4));
        if (rv != NULL) {
            command_t *cmd = NULL;
            switch (rv->type) {
            case INT_TYPE:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, node_id, "i", rv->val.ival);
                break;
            case STRING_TYPE:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, node_id, "s", rv->val.sval);
                break;
            case DOUBLE_TYPE:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, node_id, "d", rv->val.dval);
                break;
            default:;
            }
            mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
        }
    }
}

function_t esync = TBOARD_FUNC("exec_sync", exec_sync, "nnn", "", PRI_BATCH_TASK);


void execute_cmd(server_t *s, function_t *f, command_t *cmd)
{
    cnode_t *c = s->cnode;
    tboard_t *t = (tboard_t *)(c->tboard);

    if (cmd->subcmd == 0)
        task_create(t, *f, cmd->args, cmd->nargs, cmd); // no return value
    else {
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
    command_t *rcmd;
    int k;
    // when a message is received, it interprets message and adds to respective queue
    switch (cmd->cmd)
    {
    case CmdNames_REGISTER_ACK:
        // if the node is not registered, then change the state to registered
        if (c->cnstate == CNODE_NOT_REGISTERED) {
            c->cnstate = CNODE_REGISTERED;
            // send a GET_CLOUD_FOG_INFO request to the device J
            rcmd = command_new(CmdNames_GET_CLOUD_FOG_INFO, 0, "", 0, c->core->device_id, "i", 0);
            mqtt_publish(s->mqtt, c->topics->requesttopic, rcmd->buffer, rcmd->length, rcmd, 0);
        }
        return true;

    case CmdNames_PUT_CLOUD_FOG_INFO:
        // use the information to register a edge or cloud server or deregister one.
        switch (cmd->subcmd) {
            case CmdNames_CLOUD_ADD_INFO:
                // [cmd: PUT_CLOUD_FOG_INFO, subcmd: CLOUD_ADD_INFO, node_id: "cloud-id", args: [IP_addr, port_number]]
                if (c->cloudserv == NULL) 
                    c->cloudserv = cnode_create_mbroker(c, CLOUD_LEVEL, cmd->node_id, cmd->args[0].val.sval, cmd->args[1].val.ival, c->topics->subtopics, c->topics->length);
                else if (c->cloudserv->state == SERVER_NOT_REGISTERED)
                    cnode_recreate_mbroker(c->cloudserv, CLOUD_LEVEL, cmd->node_id, cmd->args[0].val.sval, cmd->args[1].val.ival, c->topics->subtopics, c->topics->length);
            break;

            case CmdNames_CLOUD_DEL_INFO:
                // [cmd: PUT_CLOUD_FOG_INFO, subcmd: CLOUD_DEL_INFO, node_id: "cloud-id"]
                if (strcmp(c->cloudserv->server_id, cmd->node_id) == 0) {
                    disconnect_mqtt_adapter(c->cloudserv->mqtt);
                }
            break;
            case CmdNames_FOG_ADD_INFO:
                // [cmd: PUT_CLOUD_FOG_INFO, subcmd: FOG_ADD_INFO, node_id: "fog-id", args: [IP_addr, port_number]]
                if (c->eservnum < MAX_EDGE_SERVERS/2) {
                    for (int i = 0; i < MAX_EDGE_SERVERS; i++) {
                        if (c->edgeserv[i] == NULL) {
                            c->edgeserv[i] = cnode_create_mbroker(c, EDGE_LEVEL, cmd->node_id, cmd->args[0].val.sval, cmd->args[1].val.ival, c->topics->subtopics, c->topics->length);
                            c->eservnum++;
                            break;
                        } else if (c->edgeserv[i]->state == SERVER_NOT_REGISTERED) {
                            cnode_recreate_mbroker(c->edgeserv[i], EDGE_LEVEL, cmd->node_id, cmd->args[0].val.sval, cmd->args[1].val.ival, c->topics->subtopics, c->topics->length);
                            c->eservnum++;
                        }
                    }
                }
            break;
            case CmdNames_FOG_DEL_INFO:
                // [cmd: PUT_CLOUD_FOG_INFO, subcmd: FOG_DEL_INFO, node_id: "fog-id"]
                for (int i = 0; i < MAX_EDGE_SERVERS; i++) {
                    if (strcmp(c->edgeserv[i]->server_id, cmd->node_id) == 0) {
                        disconnect_mqtt_adapter(c->edgeserv[i]->mqtt);
                        c->eservnum--;
                        break;
                    }
                }
            break;
        }
        return true;

    case CmdNames_PING:
        // send the PONG back to device J
        // we received -- [cmd: PING node_id: "controller id" ]
        rcmd = command_new(CmdNames_PONG, 0, "", 0, c->core->device_id, "");
        mqtt_publish(s->mqtt, c->topics->requesttopic, rcmd->buffer, rcmd->length, rcmd, 0);
        // we send -- [cmd: PONG node_id: "worker id" ]

        // if the node is not registered, start the count down to registration.. if the 
        // count do
        if (c->countdown-- <= 0) {
            c->countdown = COUNTDOWN_VALUE;
            rcmd = command_new(CmdNames_GET_CLOUD_FOG_INFO, 0, "", 0, c->core->device_id, "i", 1);
            mqtt_publish(s->mqtt, c->topics->requesttopic, rcmd->buffer, rcmd->length, rcmd, 0);
        }
        return true;

    case CmdNames_STOP:
        // Stop the node... 
        // What do we do with this message?

        // kill tboard?
        // Do some memory release?

        return true;

    case CmdNames_REXEC:
        // find the function
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

    case CmdNames_REXEC_ACK:
        // find the task
        HASH_FIND_INT(t->task_table, &(cmd->task_id), rtask);
        if (rtask != NULL)
        {
            // remove the timeout entry
            twheel_delete_timeout(t, &(rtask->task_id));
            rtask->status = TASK_ACK_RECEIVED;
            // blocking task - put back the timeout at a future time
            if (rtask->mode == TASK_MODE_REMOTE)
                twheel_add_event(t, TW_EVENT_REXEC_TIMEOUT, &(rtask->task_id), getcurtime() + globals_Timeout_REXEC_ACK_TIMEOUT);
            else {
                // if not blocking, remove it from the task table and destroy the remote task entry
                HASH_DEL(t->task_table, rtask);
                remote_task_destroy(rtask);
            }
        }
        return true;

    case CmdNames_REXEC_RES:
        // find the task
        HASH_FIND_INT(t->task_table, &(cmd->task_id), rtask);
        if (rtask != NULL)
        {
            // remove the timeout entry
            twheel_delete_timeout(t, &(rtask->task_id));
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

    case CmdNames_REXEC_ERR:
        // find the task
        HASH_FIND_INT(t->task_table, &(cmd->task_id), rtask);
        if (rtask != NULL)
        {
            // remove the timeout entry
            twheel_delete_timeout(t, &(rtask->task_id));
            if (rtask->calling_task != NULL)
            {
                rtask->status = TASK_ERROR;
                assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
                // place parent task back to appropriate queue
                task_place(t, rtask->calling_task);
            }
            else {
                // if not blocking, remove it from the task table and destroy the remote task entry
                HASH_DEL(t->task_table, rtask);
                remote_task_destroy(rtask);
            }
        }
        return true;

    case CmdNames_PUT_SCHEDULE: 
        k = 0;
        pthread_mutex_lock(&t->schmutex);
        t->sched.len = cmd->args[k].val.lval;
        k++;
        t->sched.rtslots = cmd->args[k].val.ival;
        for (int i  = 0; i < t->sched.rtslots; i++) {
            k++;
            t->sched.rtstarts[i] = cmd->args[k].val.ival;
        }
        k++;
        t->sched.syslots = cmd->args[k].val.ival;
        for (int i  = 0; i < t->sched.syslots; i++) {
            k++;
            t->sched.systarts[i] = cmd->args[k].val.ival;
        }
        pthread_mutex_unlock(&t->schmutex);
        command_free(cmd);
        return true;
    default:
        tboard_err("msg_processor: Invalid message type encountered: %d\n", cmd->cmd);
        return false;
    }
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

