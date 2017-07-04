
#include "jam.h"
#include "core.h"

#include <strings.h>
#include <string.h>
#include <pthread.h>
#include "free_list.h"


// The jactivity structure needs to be defined outside the function.
// The memory is held until freed by an explicit activity_free()
//
//
jactivity_t *jam_rexec_async(jamstate_t *js, jactivity_t *jact, char *condstr, int condvec, char *aname, char *fmask, ...)
{
    va_list args;
    nvoid_t *nv;
    int i = 0;
    arg_t *qargs;

    assert(fmask != NULL);

    // printf("Time 1: %ld\n", activity_getuseconds());


    if (strlen(fmask) > 0)
        qargs = (arg_t *)calloc(strlen(fmask), sizeof(arg_t));
    else
        qargs = NULL;

    cbor_item_t *arr = cbor_new_indefinite_array();
    cbor_item_t *elem;
    struct alloc_memory_list *list = init_list_();

    va_start(args, fmask);

    while (*fmask)
    {
        elem = NULL;
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
        if (elem != NULL){
            assert(cbor_array_push(arr, elem) == true);
            add_to_list(elem, list);
          }
    }
    va_end(args);

  //  printf("Time 2: %ld\n", activity_getuseconds());

    if (jact != NULL)
    {
        command_t *cmd = command_new_using_cbor("REXEC-ASY", "-", condstr, condvec, aname, jact->actid, js->cstate->device_id, arr, qargs, i);
        cmd->cbor_item_list = list;

  //      printf("Time 3: %ld\n", activity_getuseconds());

        jam_async_runner(js, jact, cmd);

  //      printf("Time 4: %ld\n", activity_getuseconds());

        return jact;
    }
    else
        return NULL;
}


void jam_async_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    command_t *rcmd;
    int error_count = 0;

    // TODO: Why should we use a runtable? Long term tracking
    // of activities we have run? When are the entries deleted?
    // Can we just use the activity table?
    // May be we can't because the activity table is tied to the
    // socket (queue) and we need to reuse them sooner?
    //

//    printf("Time 3.1: %ld\n", activity_getuseconds());

    int exp_replies = cloud_tree_height(js);

    printf("=======================================  Expected number of replies %d\n", exp_replies);

    runtable_insert(js, cmd->actid, cmd);
    runtableentry_t *act_entry = runtable_find(js->rtable, cmd->actid);

    if (act_entry == NULL)
    {
        printf("Cannot find activity ... \n");
        jact->state = FATAL_ERROR;
        exit(0);
    }

  //  printf("Time 3.2: %ld\n", activity_getuseconds());

    // Send the command to the remote side
    // The send is executed via the worker thread..
    queue_enq(jact->thread->outq, cmd, sizeof(command_t));

    // We expect act_entry->num_replies from the remote side
    for (int i = 0; i < exp_replies; i++)
    {

   //     printf("Time 3.3: %ld\n", activity_getuseconds());

        // TODO: Fix the constant 300 milliseconds here..
        jam_set_timer(js, jact->actid, 10);
        nvoid_t *nv = pqueue_deq(jact->thread->inq);

    //    printf("Time 3.4: %ld\n", activity_getuseconds());

        rcmd = NULL;
        if (nv != NULL)
        {
            rcmd = (command_t *)nv->data;
            free(nv);

            if (strcmp(rcmd->cmd, "TIMEOUT") == 0)
            {
                error_count++;
                printf("----- TIMEOUT-----------\n\n");
            }
            else
            {
                jam_clear_timer(js, jact->actid);
                jact->replies[i - error_count] = rcmd;
            }
        }
    }

 //   printf("Time 3.5: %ld\n", activity_getuseconds());

    if (error_count > 0) {
        jact->state = PARTIAL;
        // We have some missing replies.. see what we are missing
        process_missing_replies(jact, exp_replies, error_count);
    }
    else
    {
        // Examine the replies to form the status code
        // We have all the replies.. so no missing nodes
        //
        set_jactivity_state(jact, exp_replies);
    }

//    printf("Time 3.6: %ld\n", activity_getuseconds());

    // Set the access time
    jact->accesstime = activity_getseconds();

    // Delete the runtable entry.
    runtable_del(js->rtable, act_entry->actid);

}


void set_jactivity_state(jactivity_t *jact, int nreplies)
{
    for (int i = 0; i < nreplies; i++)
    {
        if (strcmp(jact->replies[i]->cmd, "REXEC-ACK") == 0)
            jact->state = MAX(jact->state, STARTED);
        else
        if ((strcmp(jact->replies[i]->cmd, "REXEC-NAK") == 0) &&
            (strcmp(jact->replies[i]->args[0].val.sval, "ILLEGAL-PARAMS") == 0))
            jact->state = MAX(jact->state, PARAMETER_ERROR);
        else
        if ((strcmp(jact->replies[i]->cmd, "REXEC-NAK") == 0) &&
            (strcmp(jact->replies[i]->args[0].val.sval, "NOT-FOUND") == 0))
            jact->state = MAX(jact->state, FATAL_ERROR);
        else
        if ((strcmp(jact->replies[i]->cmd, "REXEC-NAK") == 0) &&
            (strcmp(jact->replies[i]->args[0].val.sval, "CONDITION-FALSE") == 0))
            jact->state = MAX(jact->state, NEGATIVE_COND);
    }
}

void process_missing_replies(jactivity_t *jact, int nreplies, int ecount)
{
    bool devicefound = false;

    for (int i = 0; i < (nreplies - ecount); i++)
        if (strcmp(jact->replies[i]->opt, "DEVICE") == 0)
            devicefound = true;
    if (devicefound)
    {
        // Send missing recomputing tasks to DEVICE.
        if (strcmp(jact->replies[0]->cmd, "REXEC-ACK") == 0)
        {
            command_t *scmd = jact->replies[0];
            free(scmd->cmd);
            scmd->cmd = strdup("REXEC-ASY2");
            scmd = command_rebuild(scmd);
            queue_enq(jact->thread->outq, scmd, sizeof(command_t));
        }
    }
    else
        jact->state = FATAL_ERROR;
}
