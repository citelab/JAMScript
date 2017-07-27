#include "jam.h"
#include "core.h"

#include <strings.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include "free_list.h"


//
// This is running remote function synchronously.. so we wait here
// for the reply value. We use the reply value from the root of the sub tree.
// All other return values are ignored. The root of the subtree should respond.
// If it fails to respond, we quit with an error.
//
//
arg_t *jam_rexec_sync(jamstate_t *js, char *condstr, int condvec, char *aname, char *fmask, ...)
{
    va_list args;
    nvoid_t *nv;
    int i = 0;
    arg_t *qargs, *qargs2;
    arg_t *rargs;

    assert(fmask != NULL);
    if (strlen(fmask) > 0) {
        qargs = (arg_t *)calloc(strlen(fmask), sizeof(arg_t));
        qargs2 = (arg_t *)calloc(strlen(fmask), sizeof(arg_t));
    }
    else
    {
        qargs = NULL;
        qargs2 = NULL;
    }

    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *arr2 = cbor_new_indefinite_array();
    cbor_item_t *elem, *elem2;
    struct alloc_memory_list *list = init_list_();
    struct alloc_memory_list *list2 = init_list_();

    va_start(args, fmask);

    while(*fmask)
    {
        switch(*fmask++)
        {
            case 'n':
                nv = va_arg(args, nvoid_t*);
                elem = cbor_build_bytestring(nv->data, nv->len);
                elem2 = cbor_build_bytestring(nv->data, nv->len);
                qargs[i].val.nval = nv;
                qargs[i].type = NVOID_TYPE;
                break;
            case 's':
                qargs[i].val.sval = strdup(va_arg(args, char *));
                qargs[i].type = STRING_TYPE;
                elem = cbor_build_string(qargs[i].val.sval);
                elem2 = cbor_build_string(qargs[i].val.sval);
                break;
            case 'i':
                qargs[i].val.ival = va_arg(args, int);
                qargs[i].type = INT_TYPE;
                elem = cbor_build_uint32(abs(qargs[i].val.ival));
                elem2 = cbor_build_uint32(abs(qargs[i].val.ival));
                if (qargs[i].val.ival < 0)
                {
                    cbor_mark_negint(elem);
                    cbor_mark_negint(elem2);
                }
                break;
            case 'd':
            case 'f':
                qargs[i].val.dval = va_arg(args, double);
                qargs[i].type = DOUBLE_TYPE;
                elem = cbor_build_float8(qargs[i].val.dval);
                elem2 = cbor_build_float8(qargs[i].val.dval);
                break;
            default:
                break;
            qargs2[i] = qargs[i];
        }

        i++;
        if (elem)
        {
            assert(cbor_array_push(arr, elem) == true);
            assert(cbor_array_push(arr2, elem2) == true);
            add_to_list(elem, list);
            add_to_list(elem2, list2);
          }
    }
    va_end(args);
    char *t = activity_gettime(js->cstate->device_id);
    jactivity_t *jact = activity_new(js->atable, t, false);
    free(t);

    if (jact != NULL)
    {
        command_t *cmd = command_new_using_cbor("REXEC-SYN", "RTE", condstr, condvec, aname, jact->actid,
            js->cstate->device_id, arr, qargs, i);
        cmd->cbor_item_list = list;
        if (have_fog_or_cloud(js))
        {
            rargs = jam_sync_runner(js, jact, 1, cmd);
            // quit if we failed to execute at the root.
            if (rargs == NULL)
                return NULL;

            command_t *bcmd = command_new_using_cbor("REXEC-SYN", "NRT", condstr, condvec, aname, jact->actid,
                js->cstate->device_id, arr2, qargs2, i);
            bcmd->cbor_item_list = list2;

            jam_sync_runner(js, jact, (cloud_tree_height(js) - 1), bcmd);

            activity_free(jact);
            return rargs;
        }
        else
        {
            rargs = jam_sync_runner(js, jact, 1, cmd);
            activity_free(jact);
            return rargs;
        }
    }
    else
        return NULL;
}


// Launch the command (send to the J side)
// Context switch the thread (done through the pqueue_deq())
// Once the message comes or timeout happens we resume.
// If timeout happens, we don't results (NULL)

// We always return the first reply we get as the result
// of the computation
//
arg_t *jam_sync_runner(jamstate_t *js, jactivity_t *jact, int nodes, command_t *cmd)
{
    int timeout = 300;
    command_t *rcmd;
    arg_t *repcode = NULL;
    bool gotresults = false;

    #ifdef DEBUG_LVL1
        printf("Starting JAM exec runner... \n");
    #endif

    // Send the command to the remote side
    // The send is executed via the worker thread..
    queue_enq(jact->thread->outq, cmd, sizeof(command_t));

    bool acked = false;
    // Get acknowledgements
    for (int i = 0; i < nodes; i++)
    {
        jam_set_timer(js, jact->actid, timeout);
        nvoid_t *nv = pqueue_deq(jact->thread->inq);
        jam_clear_timer(js, jact->actid);
        timeout = 5;
        rcmd = NULL;
        if (nv != NULL)
        {
            rcmd = (command_t *)nv->data;
            free(nv);

            if ((strcmp(rcmd->cmd, "TIMEOUT") != 0) && (strcmp(rcmd->cmd, "REXEC-NAK") != 0))
                acked = true;
            command_free(rcmd);
        }
    }

    // We did not receive an ack (REXEC-ACK)
    if (!acked)
        return NULL;

    // Wait for the actual results.. no need to send another request.. the remote side should
    // respond to our previous request...
    // We set an arbitrary large timeout..
    // TODO: Adapt this value based on prior history
    //
    timeout = 900;

    for (int i = 0; i < nodes; i++)
    {
        jam_set_timer(js, jact->actid, timeout);
        nvoid_t *nv = pqueue_deq(jact->thread->inq);
        jam_clear_timer(js, jact->actid);
        timeout = 5;
        rcmd = NULL;
        if (nv != NULL)
        {
            rcmd = (command_t *)nv->data;
            free(nv);

            // get the first value returned by the other nodes..
            if ((strcmp(rcmd->cmd, "REXEC-RES") == 0) && (!gotresults))
            {
                // We create a structure to hold the result returned by the root
                repcode = (arg_t *)calloc(1, sizeof(arg_t));
                command_arg_copy(repcode, &(rcmd->args[0]));
                gotresults = true;
            }
            command_free(rcmd);
        }
    }

    return repcode;
}
