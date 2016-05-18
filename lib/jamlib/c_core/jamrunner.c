
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


void jrun_run_task(void *arg)
{
    temprecord_t *trec = (temprecord_t *)arg;
    jamstate_t *js = (jamstate_t *)trec->arg1;
    activity_callback_reg_t *creg = (activity_callback_reg_t *)trec->arg2;
    command_t *cmd = (command_t *)trec->arg3;
    
    free(arg);          // free the temprecord... we don't need it

    // if signature does not match get out... 
    // TODO: We could avoid this check... because the signature is not reliable
    //
    if (!jrun_check_signature(creg, cmd))
        return;
     
    // Otherwise, we are going to run the task...
    // Create an activity
    jactivity_t *jact = activity_new(js->atable, cmd->actname);
    
    // Send the ready...
    command_t *rcmd = command_new("REXEC-RDY", "ASY", cmd->actname, jact->actid, cmd->actid, "s", "__");
        
    // Wait for the start or quit and act accordingly...
    queue_enq(jact->outq, rcmd, sizeof(command_t));
    task_wait(jact->sem);
    
    nvoid_t *nv = queue_deq(jact->inq);
    assert (nv != NULL);
    rcmd = (command_t *)nv->data;
    free(nv);
        
    if (rcmd != NULL) 
    {
        if (strcmp(rcmd->cmd, "REXEC-STA") == 0)
        {
            creg->cback(jact, cmd);
        }
        return;
    }
}
