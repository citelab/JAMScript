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

    // Check whether the mask specified..
    assert(fmask != NULL);


    printf("Begin wait......\n");

    // wait for 100 seconds before failing.
    if (wait_for_machine(js, requested_level(condvec), 1000000) < 0)
    {
        printf("ERROR! Unable to connect cloud, fog, or device J node \n");
        return NULL;
    }

    printf("After wait......\n");

    // Put the parameters into a command structure
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
    // Get the activity ID.. based on time and device_id - so this should be unique
    // because the same device is not generating multiple activities at the same time with
    // high resolution timer!
    char *t = activity_gettime(js->cstate->device_id);
    jactivity_t *jact = activity_new(js->atable, t, false);
    free(t);

    if (jact != NULL)
    {
        command_t *cmd = command_new_using_cbor("REXEC-SYN", "RTE", condstr, condvec, aname, jact->actid,
            js->cstate->device_id, arr, qargs, i);
        cmd->cbor_item_list = list;
        if (machine_height(js) > 1)
        {
            jact->type = SYNC_RTE;
            printf("Calling jam runner....\n");
            rargs = jam_sync_runner(js, jact, cmd);
            // quit if we failed to execute at the root.
            if (rargs == NULL)
            {
                printf("Returning NULL \n");
                return NULL;
            }

            return rargs;

            command_t *bcmd = command_new_using_cbor("REXEC-SYN", "NRT", condstr, condvec, aname, jact->actid,
                js->cstate->device_id, arr2, qargs2, i);
            bcmd->cbor_item_list = list2;

            jact = activity_renew(js->atable, jact);
            jact->type = SYNC_NRT;
            jam_sync_runner(js, jact, bcmd);

            activity_free(jact);
            return rargs;
        }
        else
        {
            jact->type = SYNC_RTE;
            rargs = jam_sync_runner(js, jact, cmd);
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
arg_t *jam_sync_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    int results;
    int timeout = 300;
    arg_t *repcode = NULL;
    bool valid_results = false;

    #ifdef DEBUG_LVL1
        printf("Starting JAM exec runner... \n");
    #endif

    // Repeat for three times ... under failure..
    for (int i = 0; i < 3 && !valid_results; i++)
    {
        // Send the command to the remote side
        // The send is executed via the worker thread..
        activity_thread_t *athr = athread_getbyindx(js->atable, jact->jindx);
        if (athr != NULL)
        {
            queue_enq(athr->outq, cmd, sizeof(command_t));

            jam_set_timer(js, jact->actid, timeout);
            nvoid_t *nv = pqueue_deq(athr->resultq);
            jam_clear_timer(js, jact->actid);

            printf("HERE......\n");

            if (nv != NULL)
            {
                printf("THERE.......\n");

                switch (nv->len) {
                    case sizeof(arg_t):
                        repcode = (arg_t *)nv->data;
                        valid_results = true;
                        break;

                    case sizeof(int):
                        results = (*(int *)nv->data);
                        if (results)
                            valid_results = true;
                        break;

                    default:
                        break;
                }
                free(nv);
            }
        }
    }

    // repcode is NULL if there is a failure
    // repcode is not used when jam_sync_runner is used for
    // Non Root excecution...
    return repcode;
}
