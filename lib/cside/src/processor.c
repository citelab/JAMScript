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
#include "jcond.h"
#include "icache.h"
#include "dpanel.h"
#include "auxpanel.h"

arg_t* command_arg_clone_special(arg_t* arg, char* fname, uint64_t taskid, char* nodeid, void* serv) {
    arg_t* rl;
    int i = 0, nargs = 4;
    if (arg != NULL) {
        nargs += arg->nargs;
        rl = (arg_t*)calloc(nargs, sizeof(arg_t));
        command_args_copy_elements(arg, rl, arg->nargs, nargs);
        i = arg->nargs;
    } else
        rl = (arg_t*)calloc(4, sizeof(arg_t));
    rl[i].type = 's';
    rl[i].val.sval = strdup(fname);
    rl[i].nargs = nargs;
    i++;
    rl[i].type = 'l';
    rl[i].val.lval = (long long int)taskid;
    rl[i].nargs = nargs;
    i++;
    rl[i].type = 's';
    rl[i].val.sval = strdup(nodeid);
    rl[i].nargs = nargs;
    i++;
    rl[i].type = 'v';
    rl[i].val.vval = serv;
    rl[i].nargs = nargs;

    return rl;
}

void exec_sync(context_t ctx) {
    (void)ctx;
    arg_t* t = (arg_t*)(task_get_args());
    int nargs = t->nargs;
    char* fn_name = t[nargs - 4].val.sval;
    uint64_t task_id = (uint64_t)t[nargs - 3].val.lval;
    char* node_id = strdup(t[nargs - 2].val.sval);
    server_t* s = (server_t*)t[nargs - 1].val.vval;
    cnode_t* c = s->cnode;
    tboard_t* tb = (tboard_t*)(c->tboard);
    function_t* f = tboard_find_func(tb, fn_name);
    if (f != NULL) {
        arg_t rv;
        arg_t* res=blocking_task_create(tb, *f, f->tasktype, &rv, t, (nargs - 4));
        if (res != NULL) {
            command_t* cmd = NULL;
            char fmtbuf[2] = "-";
            fmtbuf[0] = rv.type;
            switch (rv.type) { // TODO add for other return types...
            case 'c':
            case 'b':
            case 'i':
            case 'u':
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, c->core->device_id, node_id, fmtbuf, rv.val.ival);
                break;
            case 'l':
            case 'z':
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, c->core->device_id, node_id, fmtbuf, rv.val.lval);
                break;
            case 'f':
            case 'd':
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, c->core->device_id, node_id, fmtbuf, rv.val.dval);
                break;
            case 's':
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, c->core->device_id, node_id, fmtbuf, rv.val.sval);
                break;
            default:
                cmd = command_new(CmdNames_REXEC_RES, 0, "", task_id, c->core->device_id, node_id, fmtbuf, rv.val.nval);
            }
            free(node_id);
            mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
        }
    }
}

function_t esync = TBOARD_FUNC("exec_sync", exec_sync, "nnn", NULL, PRI_BATCH_TASK);

void execute_cmd(server_t* s, function_t* f, command_t* cmd) {
    cnode_t* c = s->cnode;
    tboard_t* t = (tboard_t*)(c->tboard);

    if (cmd->subcmd == 0)
        task_create(t, *f, cmd->args, cmd); // no return value
    else {
        arg_t* a = command_arg_clone_special(cmd->args, cmd->fn_name, cmd->task_id, cmd->node_id, s);
        task_create(t, esync, a, NULL);
        command_free(cmd);
    }
}

// TODO: consider adding function to add task_t task so we dont have to do this both here and task_create
void msg_processor(void* serv, command_t* cmd) {
    function_t* f;
    server_t* s = (server_t*)serv;
    cnode_t* c = s->cnode;
    tboard_t* t = (tboard_t*)(c->tboard);
    dpanel_t* dp = (dpanel_t*)c->dpanel;
    auxpanel_t* a;

    command_t* rcmd;
    int k;
    struct queue_entry* e = NULL;
    internal_command_t* ic;
    // when a message is received, it interprets message and adds to respective queue
    switch (cmd->cmd) {
    case CmdNames_REGISTER_ACK:
        // if the node is not registered, then change the state to registered
        if (c->cnstate == CNODE_NOT_REGISTERED) {
            c->cnstate = CNODE_REGISTERED;
            // send a GET_CLOUD_FOG_INFO request to the device J
            rcmd = command_new(CmdNames_GET_CLOUD_FOG_INFO, 0, "", 0, c->core->device_id, "", "i", 0);
            mqtt_publish(s->mqtt, c->topics->requesttopic, rcmd->buffer, rcmd->length, rcmd, 0);
        }
        command_free(cmd);
        return;
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
            if (strcmp(c->cloudserv->server_id, cmd->node_id) == 0)
                disconnect_mqtt_adapter(c->cloudserv->mqtt);
            break;
        case CmdNames_FOG_ADD_INFO:
            printf("+++ ++ ++ +++ Put fog info received.... %s\n", cmd->node_id);
            // [cmd: PUT_CLOUD_FOG_INFO, subcmd: FOG_ADD_INFO, node_id: "fog-id", args: [IP_addr, port_number]]
            if (c->eservnum < MAX_EDGE_SERVERS/2) {
                for (int i = 0; i < MAX_EDGE_SERVERS; i++) {
                    if (c->edgeserv[i] == NULL) {
                        c->edgeserv[i] = cnode_create_mbroker(c, EDGE_LEVEL, cmd->node_id, cmd->args[0].val.sval, cmd->args[1].val.ival, c->topics->subtopics, c->topics->length);
                        c->eservnum++;
                        break;
                    } else if (c->edgeserv[i]->state == SERVER_UNUSED) {
                        cnode_recreate_mbroker(c->edgeserv[i], EDGE_LEVEL, cmd->node_id, cmd->args[0].val.sval, cmd->args[1].val.ival, c->topics->subtopics, c->topics->length);
                        c->eservnum++;
                        break;
                    }
                }
            }
            break;
        case CmdNames_FOG_DATA_UP:
            printf("======================== data up =========== %s %d\n", cmd->args[0].val.sval, cmd->args[1].val.ival);
            a = apanel_create(dp, cmd->args[0].val.sval, cmd->args[1].val.ival);
            apanel_start(a);
            dpanel_add_apanel(dp, cmd->node_id, a);
            break;
        case CmdNames_FOG_DATA_DOWN:
            dpanel_del_apanel(dp, cmd->node_id);
            break;

        case CmdNames_FOG_DEL_INFO:
            printf("-- -- --- -- -- Delete fog ... %s\n", cmd->node_id);
            // [cmd: PUT_CLOUD_FOG_INFO, subcmd: FOG_DEL_INFO, node_id: "fog-id"]
            for (int i = 0; i < MAX_EDGE_SERVERS; i++) {
                if (c->edgeserv[i] != NULL) {
                    if (strcmp(c->edgeserv[i]->server_id, cmd->node_id) == 0) {
                        send_close_msg(c->edgeserv[i], c->core->device_id, 0);
                        break;
                    }
                }
            }
            break;

        }
        command_free(cmd);
        return;

    case CmdNames_PING:
        // send the PONG back to device J
        // we received -- [cmd: PING node_id: "controller id" ]
        rcmd = command_new(CmdNames_PONG, 0, "", 0, c->core->device_id, "", "");
        mqtt_publish(s->mqtt, c->topics->requesttopic, rcmd->buffer, rcmd->length, rcmd, 0);
        // we send -- [cmd: PONG node_id: "worker id" ]

        // if the node is not registered, start the count down to registration.. if the
        // count do
        if (c->cnstate == CNODE_NOT_REGISTERED)
            send_reg_msg(c->devserv, c->core->device_id, 0);
        command_free(cmd);
        return;

    case CmdNames_STOP:
        // Stop the node...
        // What do we do with this message?

        // kill tboard?
        // Do some memory release?
        command_free(cmd);
        exit(0);
        return;

    case CmdNames_REXEC:
        // if a duplicate command, silently drop the command
        if (icache_lookup(t->icache, cmd->task_id, cmd->node_id)) {
            command_free(cmd);
            return;
        }
        icache_insert(t->icache, cmd->task_id, cmd->node_id);

        // otherwise, find the function
        f = tboard_find_func(t, cmd->fn_name);
        if (f == NULL) {
            send_err_msg(s, cmd->node_id, cmd->task_id);
            // send REXEC_ERR to the controller that sent the request
            command_free(cmd);
            return;
        } else if (f->cond) {
            // TODO populate these values properly
            jcond_my_t my;
            jcond_your_t your;
            if ((*f->cond)(my, your) != true) {
                send_nak_msg(s, cmd->node_id, cmd->task_id);
                command_free(cmd);
                return;
            }
        }
        // send the REXEC_ACK to the controller that sent the request
        send_ack_msg(s, cmd->node_id, cmd->task_id, ((cmd->subcmd == 0) ? 0: globals_Timeout_REXEC_ACK_TIMEOUT));
        // cmd is freed after the task is completed.. otherwise we will create a memory fault
        execute_cmd(s, f, cmd);
        return;

    case CmdNames_REXEC_ACK:
    case CmdNames_REXEC_RES:
    case CmdNames_REXEC_ERR:
        ic = internal_command_new(cmd);
        e = queue_new_node(ic);
        pthread_mutex_lock(&t->iqmutex);
        queue_insert_tail(&(t->iq), e);
        pthread_mutex_unlock(&t->iqmutex);
        command_free(cmd);
        return;

    case CmdNames_CLOSE_PORT:
        disconnect_mqtt_adapter(s->mqtt);
        command_free(cmd);
        return;

    case CmdNames_PUT_SCHEDULE:
        k = 0;
        pthread_mutex_lock(&t->schmutex);
        t->sched.len = cmd->args[k].val.lval; // TODO this is being stored as an int though...?
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
        return;
    default:
        //tboard_err("msg_processor: Invalid message type encountered: %d\n", cmd->cmd);
        command_free(cmd);
        return;
    }
}

void send_close_msg(void* serv, char* node_id, uint64_t task_id) {
    server_t* s = (server_t*)serv;
    cnode_t* c = s->cnode;
    command_t* cmd = command_new(CmdNames_CLOSE_PORT, 0, "", task_id, c->core->device_id, node_id, "");
    mqtt_publish(s->mqtt, c->topics->selfrequesttopic, cmd->buffer, cmd->length, cmd, 0);
}

void send_err_msg(void* serv, char* node_id, uint64_t task_id) {
    server_t* s = (server_t*)serv;
    cnode_t* c = s->cnode;
    command_t* cmd = command_new(CmdNames_REXEC_ERR, 0, "", task_id, c->core->device_id, node_id, "i", (int)CmdNames_FUNC_NOT_FOUND);
    mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
}

void send_ack_msg(void* serv, char* node_id, uint64_t task_id, int timeout) {
    server_t* s = (server_t*)serv;
    cnode_t* c = s->cnode;
    command_t* cmd = command_new(CmdNames_REXEC_ACK, 0, "", task_id, c->core->device_id, node_id, "i", timeout);
    mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
}

void send_nak_msg(void* serv, char* node_id, uint64_t task_id) {
    server_t* s = (server_t*)serv;
    cnode_t* c = s->cnode;
    command_t* cmd = command_new(CmdNames_REXEC_NAK, 0, "", task_id, c->core->device_id, node_id, "i", (int)CmdNames_COND_FALSE);
    mqtt_publish(s->mqtt, c->topics->replytopic, cmd->buffer, cmd->length, cmd, 0);
}

void send_reg_msg(void* serv, char* node_id, uint64_t task_id) {
    server_t* s = (server_t*)serv;
    cnode_t* c = s->cnode;
    command_t* cmd = command_new(CmdNames_REGISTER, 0, "", task_id, c->core->device_id, node_id, "");
    mqtt_publish(s->mqtt, c->topics->requesttopic, cmd->buffer, cmd->length, cmd, 0);
}
