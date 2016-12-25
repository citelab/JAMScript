#include "jam.h"
#include "core.h"

#include <strings.h>
#include <string.h>
#include <pthread.h>
#include "free_list.h"

//
// This is running remote function synchronously.. so we wait here
// for the reply value..
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

    command_t *cmd = command_new_using_cbor("REXEC", "SYN", aname, jact->actid, js->cstate->device_id, arr, qargs, i);
    cmd->cbor_item_list = list;
    
    insert_runtable_entry(js, cmd);
    runtableentry_t *act_entry = find_table_entry(js->rtable, cmd);
    #ifdef DEBUG_LVL1
        printf("Starting JAM exec runner... \n");
    #endif

    jam_sync_runner(js, jact, cmd);

    if (jact->state == TIMEDOUT)
    {
        activity_del(js->atable, jact);
        free_rtable_entry(act_entry, js->rtable);
        return NULL;
    }
    else
    {
 //       arg_t *code = command_arg_clone(jact->code);
        activity_del(js->atable, jact);
        free_rtable_entry(act_entry, js->rtable);
        return NULL;  // TODO: CHeck .. this was "code"
    }
}


void jam_sync_runner(jamstate_t *js, jactivity_t *jact, command_t *cmd)
{
    command_t *rcmd;
    runtableentry_t *act_entry = find_table_entry(js->rtable, cmd);
    if(act_entry == NULL){
        printf("Cannot find activity ... \n");
        jact->state = FATAL_ERROR;
        return;
    }
    // for(int i = 0; i < act_entry->num_replies; i++){
    //     printf("Sending msg ...\n");
    //     socket_send(js->cstate->reqsock[i], cmd);
    //     printf("Was here .... \n");
    //     if(socket_recv_command(js->cstate->reqsock[i], 5000) == NULL)
    //         printf("ERROR ... \n");
    //     printf("WAIT WHAT \n");
    // }
    printf("Initiating Activity ... \n");
    for(int i = 0; i < act_entry->num_replies; i++){
        queue_enq(jact->outq, cmd, sizeof(command_t));

        nvoid_t *nv = pqueue_deq(jact->inq);
        if(nv == NULL){
            jact->state = FATAL_ERROR;
            return;
        }
        rcmd = (command_t *)nv->data;
        free(nv);
        printf("Round : %d\n", i);
        if(rcmd == NULL){
            jact->state = FATAL_ERROR;
            return;
        }else if(strcmp(rcmd->cmd,"REXEC-NAK") == 0){
            printf("Failure to acknowledge ...\n");
          //  jact->code = command_arg_clone(&(rcmd->args[0]));
            jact->state = FATAL_ERROR;
            command_free(rcmd);
            return;
        }else if(strcmp(rcmd->cmd, "REXEC-ACK") == 0){
            printf("Acknowledged ... \n");
          //  act_entry->num_rcv_response++;
            if(i == act_entry->num_replies){
                nvoid_t *nv = pqueue_deq(jact->inq);
                rcmd = (command_t *)nv->data;
                free(nv);
            }
        }
        free(rcmd);
    }

   // act_entry->num_rcv_response = 0;            
    //Now Retrive the data 
    for(int i = 0; i < act_entry->num_replies; i++){
        command_t *lcmd = command_new("REXEC-RES", "GET", jact->name, jact->actid, js->cstate->device_id, "");
        queue_enq(jact->outq, lcmd, sizeof(command_t));
        printf("After enqueuing stuff\n");
        jam_set_timer(js, jact->actid, 200);
        printf("Before wait !\n");

        nvoid_t *nv = pqueue_deq(jact->inq);
        rcmd = (command_t *)nv->data;
        free(nv);
        if (strcmp(rcmd->cmd, "REXEC-RES") == 0 && strcmp(rcmd->opt, "PUT") == 0){
            printf("Results Received ... \n");
           // jact->code = command_arg_clone(&(rcmd->args[0]));
            jact->state = COMPLETED;
            command_free(rcmd);
            jam_clear_timer(js, jact->actid);
      //      act_entry->num_rcv_response++;
        }else if(strcmp(rcmd->cmd, "TIMEOUT") == 0){
            printf("Request timed out ... \n");
            jact->state = FATAL_ERROR;
            return;
        }
    }
    // command_t *rcmd;
    // queue_enq(jact->outq, cmd, sizeof(command_t));
    // task_wait(jact->sem);
    // int args = 0;
    // int current_stuff = 0;
    // int sent = 0;
    // while(1){
    //     nvoid_t *nv = queue_deq(jact->inq);
    //     rcmd = (command_t *)nv->data;
    //     free(nv);
    //     if (rcmd == NULL){
    //        jact->state = FATAL_ERROR;
    //         return;
    //     }else if(strcmp(rcmd->cmd, "REXEC-NAK") == 0){
    //         printf("Failure to acknowledge ...\n");
    //         jact->code = command_arg_clone(&(rcmd->args[0]));
    //         jact->state = FATAL_ERROR;
    //         command_free(rcmd);
    //         return;
    //     }else if (strcmp(rcmd->cmd, "REXEC-ACK") == 0){
    //         printf("Acknowledged ...\n");
    //         int timerval = 0;
    //         if ((rcmd->nargs == 0) ||
    //             (rcmd->nargs == 1 && rcmd->args[0].type != INT_TYPE))
    //         // did not get a valid timerval, why??
    //         // may be somekind of bug? set 100 millisecs by default
    //             timerval = 200;
    //         else
    //             timerval = rcmd->args[0].val.ival + 200;

    //     // Waiting for the lease time amounts
    //         runtableentry_t *act_entry = find_table_entry(js->rtable, rcmd);
    //         if(act_entry == NULL){
    //             printf("Act Entry Not Found ... \n");
    //             break;
    //         }            
    //         if(args == act_entry->num_replies){
    //             command_free(rcmd);
    //             task_wait(jact->sem);
    //             args++;
    //         }else{
    //             command_free(rcmd);
    //             jam_set_timer(js, jact->actid, timerval);
    //             task_wait(jact->sem);
    //         }
    //     }else if(strcmp(rcmd->cmd, "TIMEOUT") == 0){
    //         printf("Timeout! ...\n");
    //         runtableentry_t *act_entry = find_table_entry(js->rtable, rcmd);
    //         if(act_entry == NULL){
    //             printf("Cannot find activity ... \n");
    //             break;
    //         }
    //         printf("So we got here ... \n");
    //         act_entry->num_rcv_response = 0;            
    //         command_t *lcmd = command_new("REXEC-RES", "GET", jact->name, jact->actid, js->cstate->conf->device_id, "");
    //         queue_enq(jact->outq, lcmd, sizeof(command_t));
    //         printf("After enqueuing stuff\n");
    //         command_free(rcmd);
    //         jam_set_timer(js, jact->actid, 300);
    //         args = 0;
    //         printf("Before wait !\n");
    //         task_wait(jact->sem);
    //     }else if (strcmp(rcmd->cmd, "REXEC-RES") == 0 && strcmp(rcmd->opt, "PUT") == 0){
    //         printf("Results Received ... \n");
    //         jact->code = command_arg_clone(&(rcmd->args[0]));
    //         jact->state = COMPLETED;
    //         command_free(rcmd);
    //         jam_clear_timer(js, jact->actid);
    //         break;
    //     }
    // }
    // 
    // command_t *rcmd;

    
    
}
