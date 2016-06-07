#include "jam.h"
#include "core.h"

#include <strings.h>
#include <string.h>
#include <pthread.h>
#include "free_list.h"

//
// TODO: Is there a better way to write this code?
// At this point, a big chunk of the code is replicated.. too bad
//
//
arg_t *jam_rexec_sync(jamstate_t *js, char *aname, char *fmask, ...)
{
    va_list args;
    nvoid_t *nv;
    int i = 0;
    arg_t *qargs;

    assert(fmask != NULL);
    
    if (strlen(fmask) > 0)
        qargs = (arg_t *)calloc(strlen(fmask), sizeof(arg_t));
    else
        qargs = NULL;

    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *elem;
    struct alloc_memory_list *list = init_list_();

    va_start(args, fmask);

    while(*fmask)
    {
        switch(*fmask++)
        {
            case 'n':
                nv = va_arg(args, nvoid_t*);
                elem = cbor_build_bytestring(nv->data, nv->len);
                qargs[i].val.nval = nv;
                qargs[i].type = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char *));
                qargs[i].type = STRING_TYPE;
                elem = cbor_build_string(qargs[i].val.sval);
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type = INT_TYPE;
                elem = cbor_build_uint32(abs(qargs[i].val.ival));
                if (qargs[i].val.ival < 0)
                    cbor_mark_negint(elem);
                break;
            case 'd':
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type = DOUBLE_TYPE;
                elem = cbor_build_float8(qargs[i].val.dval);
                break;
            default:
                break;
        }
        i++;
        if (elem){
            assert(cbor_array_push(arr, elem) == true);
            add_to_list_(elem, list);
          }
    }
    va_end(args);
    jactivity_t *jact = activity_new(js->atable, aname);

    command_t *cmd = command_new_using_cbor("REXEC", "SYN", aname, jact->actid, js->cstate->conf->device_id, arr, qargs, i);
    cmd->cbor_item_list = list;
    #ifdef DEBUG_LVL1
        printf("Starting JAM exec runner... \n");
    #endif

    jam_sync_runner(js, jact, cmd);

    if (jact->state == EXEC_TIMEDOUT)
    {
        activity_del(js->atable, jact);
        return NULL;
    }
    else
    {
        arg_t *code = command_arg_clone(jact->code);
        activity_del(js->atable, jact);
        return code;
    }
}



void jam_sync_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    command_t *rcmd;

    // The protocol for REXEC processing is still evolving.. it is without
    // retries at this point. May be with nanomsg we don't need retries at the
    // RPC level. This is something we need to investigate closely by looking at
    // the reliability model that is provided by nanonmsg.

    // Send the command.. and wait for reply..
    queue_enq(jact->outq, cmd, sizeof(command_t));
    task_wait(jact->sem);

    nvoid_t *nv = queue_deq(jact->inq);
    rcmd = (command_t *)nv->data;
    free(nv);

    if (rcmd == NULL)
    {
        jact->state = EXEC_ERROR;
        return;
    }

    // What is the reply.. positive ACK and negative problem in that case
    // stick the error code in the activity
    if (strcmp(rcmd->cmd, "REXEC-ACK") == 0)
    {
        int timerval = 0;
        if ((rcmd->nargs == 0) ||
            (rcmd->nargs == 1 && rcmd->args[0].type != INT_TYPE))
            // did not get a valid timerval, why??
            // may be somekind of bug? set 100 millisecs by default
            timerval = 100;
        else
            timerval = rcmd->args[0].val.ival;

        // Waiting for the lease time amounts
        command_free(rcmd);
        jam_set_timer(js, jact->actid, timerval);
        task_wait(jact->sem);

        nvoid_t *nv = queue_deq(jact->inq);
        rcmd = (command_t *)nv->data;
        free(nv);

        // If we did not get woken up by the timer, we need to cancel the
        // timer. The publish notification from the j-core should have
        // woken the activity
        if (strcmp(rcmd->cmd, "TIMEOUT") != 0)
        {
            jam_clear_timer(js, jact->actid);

            // It is not a timer wake up.. so it better be because of a
            // published message..
            if (!(strcmp(rcmd->cmd, "REXEC-RES") == 0 && strcmp(rcmd->opt, "AVL") == 0))
            {
                jact->state = EXEC_ERROR;
                command_free(rcmd);
                return;
            }
        }
        command_free(rcmd);

        // Now ask for the results from the j-core
        // [[ REXEC-RES GET actname actid device_id ]]
        command_t *lcmd = command_new("REXEC-RES", "GET", jact->name, jact->actid, js->cstate->conf->device_id, "");
        queue_enq(jact->outq, lcmd, sizeof(command_t));
        task_wait(jact->sem);

        nv = queue_deq(jact->inq);
        rcmd = (command_t *)nv->data;
        free(nv);

        // We expect the following: [[ REXEC-RES PUT actname actid code-type return-code ]]
        if (strcmp(rcmd->cmd, "REXEC-RES") == 0 && strcmp(rcmd->opt, "PUT") == 0)
        {
            jact->code = command_arg_clone(&(rcmd->args[0]));
            jact->state = EXEC_COMPLETE;
        }

        command_free(rcmd);
    }
    else{
      if (strcmp(rcmd->cmd, "REXEC-NAK") == 0) {
          jact->code = command_arg_clone(&(rcmd->args[0]));
          jact->state = EXEC_ERROR;
        }
        command_free(rcmd);
    }
}
