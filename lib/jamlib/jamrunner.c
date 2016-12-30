
#include <stdlib.h>
#include <assert.h>
#include <string.h>
#include <stdbool.h>

#include "jam.h"
#include "activity.h"
#include "command.h"



bool jrun_check_signature(activity_callback_reg_t *creg, command_t *cmd)
{
    int i;
    if (strlen(creg->signature) != cmd->nargs)
        return false;
    for (i = 0; i < strlen(creg->signature); i++)
    {
        if (creg->signature[i] == 'i' && cmd->args[i].type != INT_TYPE)
            return false;
        else
        if (creg->signature[i] == 's' && cmd->args[i].type != STRING_TYPE)
            return false;
        else
        if (creg->signature[i] == 'd' && cmd->args[i].type != DOUBLE_TYPE)
            return false;
    }
    return true;
}


void jrun_arun_callback(jamstate_t *js, command_t *cmd, activity_callback_reg_t *creg)
{
    command_t *rcmd;

    // Create an activity to run the callback function. 
    // 
    jactivity_t *jact = activity_new(js->atable, cmd->actname);
    jact->actarg = strdup(cmd->actid);
    jact->taskid = taskid();

    #ifdef DEBUG_LVL1
        printf("Starting the function....................\n");
    #endif

    creg->cback(jact, cmd);

    command_free(cmd);
    activity_del(js->atable ,jact);
}


void jrun_run_callback(jamstate_t *js, command_t *cmd, activity_callback_reg_t *creg)
{
    command_t *rcmd;

    // if signature does not match get out...
    // TODO: We could avoid this check... because the signature is not reliable
    //
    if (!jrun_check_signature(creg, cmd))
        return;

    // Otherwise, we are going to run the task...
    // Create an activity
    jactivity_t *jact = activity_new(js->atable, cmd->actname);
    jact->actarg = strdup(cmd->actid);
    jact->taskid = taskid();

    if(strcmp(cmd->cmd, "REXEC-JDATA") != 0){
        #ifdef DEBUG_LVL1
            printf("Sending the ready..........................\n");
        #endif
    // Send the ready...
        if (creg->type == ASYNC)
            rcmd = command_new("REXEC-RDY", "ASY", cmd->actname, jact->actid, cmd->actid, "s", "__");
        else
            rcmd = command_new("REXEC-RDY", "SYN", cmd->actname, jact->actid, cmd->actid, "s", "__");
        
        rcmd->socket_indx = cmd->socket_indx;
        #ifdef DEBUG_LVL1
            printf("----Waitnnnn..........................\n");
        #endif

    // Wait for the start or quit and act accordingly...
        queue_enq(jact->outq, rcmd, sizeof(command_t));

        #ifdef DEBUG_LVL1
            printf("----Waitnnnn..........................\n");
        #endif

        nvoid_t *nv = pqueue_deq(jact->inq);
        assert (nv != NULL);
        rcmd = (command_t *)nv->data;
        free(nv);
        if (rcmd != NULL)
        {
            if (strcmp(rcmd->cmd, "REXEC-STA") == 0)
            {
                #ifdef DEBUG_LVL1
                    printf("Starting the function.........................\n");
                #endif
                creg->cback(jact, cmd);
            }
            command_free(rcmd);
        }
    }else{
        #ifdef DEBUG_LVL1
            printf("Starting the jdata function.........................\n");
        #endif
        creg->cback(jact, cmd);    
    }
    command_free(cmd);
    activity_del(js->atable ,jact);
}
