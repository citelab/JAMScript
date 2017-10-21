
#include "jam.h"
#include "core.h"

#include <strings.h>
#include <string.h>
#include <pthread.h>
#include "free_list.h"


// Local execution handler
// What should go in here??
//
jactivity_t *jam_lexec_async(char *aname, ...)
{
    return NULL;
}

// The jactivity structure needs to be defined outside the function.
// The memory is held until freed by an explicit activity_free()
//
//
void jam_rexec_async(jamstate_t *js, jactivity_t *jact, char *condstr, int condvec, char *aname, char *fmask, ...)
{
    va_list args;
    nvoid_t *nv;
    int i = 0;
    arg_t *qargs;

    assert(fmask != NULL);
    // Check the height condition
    if (machine_height(js) < requested_level(condvec))
        return;

    if (strlen(fmask) > 0)
        qargs = (arg_t *)calloc(strlen(fmask), sizeof(arg_t));
    else
        qargs = NULL;

    jact->type = ASYNC;
    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *elem;
    struct alloc_memory_list *list = init_list_();

    va_start(args, fmask);

    while (*fmask)
    {
        elem = NULL;
        switch (*fmask++)
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
        if (elem != NULL){
            assert(cbor_array_push(arr, elem) == true);
            add_to_list(elem, list);
          }
    }
    va_end(args);

    if (jact != NULL)
    {
        command_t *cmd = command_new_using_cbor("REXEC-ASY", "-", condstr, condvec, aname, jact->actid, js->cstate->device_id, arr, qargs, i);
        cmd->cbor_item_list = list;
        jam_async_runner(js, jact, cmd);
    }
}


void jam_async_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    int timeout = 300;
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
    printf("=======Jindx %d, jact-jindx %d\n", athr->jindx, jact->jindx);
    printf("Command actid %s\n", cmd->actid);
    printf("Jact actid %s\n", jact->actid);

    // Repeat for three times ... under failure..
    for (int i = 0; i < 3 && !valid_acks; i++)
    {
        command_hold(cmd);
        // Send the command to the remote side
        // The send is executed via the worker thread..
        queue_enq(athr->outq, cmd, sizeof(command_t));

        jam_set_timer(js, jact->actid, timeout);
        nvoid_t *nv = pqueue_deq(athr->resultq);

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
        jact = activity_renew(js->atable, jact);
    }
    // Delete the runtable entry.
    runtable_del(js->rtable, act_entry->actid);
    command_free(cmd);
}
