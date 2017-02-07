
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


void jrun_arun_callback(activity_table_t *at, command_t *cmd, activity_callback_reg_t *creg)
{
    command_t *rcmd;

    // Create an activity to run the callback function. 
    // 
    jactivity_t *jact = activity_new(at, cmd->actid);
    jact->thread->actid = strdup(cmd->actid);

    #ifdef DEBUG_LVL1
        printf("Starting the function....................\n");
    #endif

    creg->cback(jact, cmd);

    // Don't free cmd here.. it should be freed in the calling function..
}

