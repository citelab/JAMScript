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
    rvalue_t *rval;
    rvalue_t *rval2;
    arg_t *qargs = NULL, *qargs2 = NULL;
    cbor_item_t *arr, *arr2;
    struct alloc_memory_list *list, *list2;

    arg_t *rargs;

    // Check whether the mask specified..
    assert(fmask != NULL);

    // wait for 100 seconds before failing.
    if (wait_for_machine(js, requested_level(condvec), 1000000) < 0)
    {
        printf("ERROR! Unable to connect cloud, fog, or device J node \n");
        return NULL;
    }

    // Put the parameters into a command structure
    if (strlen(fmask) > 0)
    {
        va_start(args, fmask);
        rval = command_qargs_alloc(1, fmask, args);
        rval2 = command_qargs_alloc(1, fmask, args);
        va_end(args);

        qargs = rval->qargs;
        list = rval->list;
        arr = rval->arr;
        free(rval);
        qargs2 = rval2->qargs;
        list2 = rval2->list;
        arr2 = rval2->arr;
        free(rval2);
    } else {
        arr = cbor_new_indefinite_array();
        arr2 = cbor_new_indefinite_array();
        list = init_list_();
        list2 = init_list_();
    }

    // Get the activity ID.. based on time and device_id - so this should be unique
    // because the same device is not generating multiple activities at the same time with
    // high resolution timer!
    char *t = activity_gettime(js->cstate->device_id);
    jactivity_t *jact = activity_new(js->atable, t, false);
    free(t);

    if (jact != NULL)
    {
        command_t *cmd = command_new_using_cbor("REXEC-SYN", "RTE", condstr, condvec, aname, jact->actid,
            js->cstate->device_id, arr, qargs, strlen(fmask));
        cmd->cbor_item_list = list;

        if (machine_height(js) > 1)
        {
            jact->type = SYNC_RTE;
            rargs = jam_sync_runner(js, jact, cmd);
            // quit if we failed to execute at the root.
            if (rargs == NULL)
            {
                printf("Returning NULL \n");
                return NULL;
            }

            return rargs;

            command_t *bcmd = command_new_using_cbor("REXEC-SYN", "NRT", condstr, condvec, aname, jact->actid,
                js->cstate->device_id, arr2, qargs2, strlen(fmask));
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

            printf("Hi...i = %d\n", i);
            jam_set_timer(js, jact->actid, timeout);
            printf("Hi 2 \n");
            nvoid_t *nv = pqueue_deq(athr->resultq);
                        printf("Hi 3 \n");
            jam_clear_timer(js, jact->actid);
            printf("Hi 4 i = %d\n", i);
            if (nv != NULL)
            {
                            printf("Hi...5\n");
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
