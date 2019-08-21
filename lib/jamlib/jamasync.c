
#include "jam.h"
#include "core.h"

#include <strings.h>
#include <string.h>
#include <pthread.h>
#include "free_list.h"


// Local execution handler
//
void jam_lexec_async(jamstate_t *js, char *aname, ...)
{
    va_list args;
    rvalue_t *rval;
    arg_t *qargs = NULL;

    jactivity_t *jact = jam_create_activity(js);
    activity_callback_reg_t *creg = activity_findcallback(js->atable, aname);

    jact->type = ASYNC;
    char *fmask = creg->signature;
    if (strlen(fmask) > 0)
    {
        va_start(args, aname);
        rval = command_qargs_alloc(0, fmask, args);
        va_end(args);
        qargs = rval->qargs;
        free(rval);
    }

    command_t *cmd = command_new_using_arg_only("LEXEC-ASY", "-", "-", 0, aname, jact->actid, "-", qargs, strlen(fmask));
    activity_thread_t *athr = athread_getbyindx(js->atable, jact->jindx);
    pqueue_enq(athr->inq, cmd, sizeof(command_t));

    // activity is deallocated after the run has completed...
}

// The jactivity structure needs to be defined outside the function.
// The memory is held until freed by an explicit activity_free()
//
//
jactivity_t *jam_rexec_async(jamstate_t *js, jactivity_t *jact, char *condstr, int condvec, char *aname, char *fmask, ...)
{
    va_list args;
    rvalue_t *rval;
    arg_t *qargs = NULL;
    cbor_item_t *arr = NULL;
    struct alloc_memory_list *list = NULL;

    if (jact == NULL)
        return NULL;

    assert(fmask != NULL);

    // wait for 250 milliseconds before failing.
    if (wait_for_machine(js, requested_level(condvec), 1000) < 0)
    {
        int lv = requested_level(condvec);
        if (lv == 3)
            printf("ERROR! Cloud required by the program - unable to connect to Cloud\n");
        else if (lv == 2)
            printf("ERROR! Fog required by the program - unable to connect to Fog\n");
        else
            printf("ERROR! Unable to connect to J node\n");
        return NULL;
    }

    jact->type = ASYNC;

    if (strlen(fmask) > 0)
    {
        va_start(args, fmask);
        rval = command_qargs_alloc(1, fmask, args);
        va_end(args);
        qargs = rval->qargs;
        list = rval->list;
        arr = rval->arr;
        free(rval);
    }

    if (jact != NULL)
    {
        command_t *cmd = command_new_using_cbor("REXEC-ASY", "-", condstr, condvec, aname, jact->actid, js->cstate->device_id, arr, qargs, strlen(fmask));
        cmd->cbor_item_list = list;
        return jam_async_runner(js, jact, cmd);
    }
    else
        return NULL;
}


jactivity_t *jam_async_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    int timeout = 150;
    bool valid_acks = false;
    int results;

    #ifdef DEBUG_LVL1
        printf("Starting JAM ASYNC exec runner... \n");
    #endif

    runtable_insert(js, cmd->actid, cmd);
    runtableentry_t *act_entry = runtable_find(js->rtable, cmd->actid);
    // No need to release act_entry - it is part of the runtable

    if (act_entry == NULL)
    {
        printf("FATAL ERROR!! Cannot find activity ... \n");
        exit(0);
    }

    activity_thread_t *athr = athread_getbyindx(js->atable, jact->jindx);

    // Repeat for three times ... under failure..
    //for (int i = 0; i < 3 && !valid_acks; i++)
    //{
        command_hold(cmd);
        // Send the command to the remote side
        // The send is executed via the worker thread..
        queue_enq(athr->outq, cmd, sizeof(command_t));

        jam_set_timer(js, jact->actid, timeout);
        nvoid_t *nv = pqueue_deq(athr->resultq);
        jam_clear_timer(js, jact->actid);

        if (nv != NULL)
        {
            switch (nv->len) {
                case sizeof(int):
                    memcpy(&results, nv->data, sizeof(int));
                    if (results)
                        valid_acks = true;
                    break;

                default:
                    break;
            }
            free(nv);
        }
    //    jact = activity_renew(js->atable, jact);
    //}
    // Delete the runtable entry.
    runtable_del(js->rtable, act_entry->actid);
    command_free(cmd);

    return jact;
}
