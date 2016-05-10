
#include <stdlib.h>
#include <assert.h>
#include <string.h>
#include <stdbool.h>

#include "jamrunner.h"
#include "command.h"



// Register function into the runner; 
// We give the following parameters in the registration: name, type, param signature

void jrun_reg_task(tasktable_t *tt, char *name, int type, char *signature, taskcallback_f cback)
{
    taskentry_t *ten = (taskentry_t *)calloc(1, sizeof(taskentry_t));
    assert(ten != NULL);
    
    ten->type = type;
    ten->cback = cback;
    ten->state = TASK_NEW;
    ten->signature = strdup(signature);
    
    ten->name = strdup(name);    
    tt->tasks[tt->numtasks++] = ten;
}


// 
// For now, this is a linear search..
// TODO: Do we need to fix this? May be the number of activities are small..
//
taskentry_t *jrun_find_task(tasktable_t *tt, char *name)
{
    int i;
    
    for (i = 0; i < tt->numtasks; i++)
    {
        if (strcmp(tt->tasks[i]->name, name) == 0)
            return tt->tasks[i];
    }
    
    return NULL; 
}


bool jrun_conform_task(taskentry_t *ten, void *arg)
{
    int i;
    command_t *cmd = (command_t *)arg;
    
    if (strlen(ten->signature) != cmd->nargs)
        return false;
    
    for (i = 0; i < strlen(ten->signature); i++)
    {
        if (ten->signature[i] == 'i' && cmd->args[i].type != INT_TYPE)
            return false;
        else
        if (ten->signature[i] == 's' && cmd->args[i].type != STRING_TYPE)
            return false;
        else
        if (ten->signature[i] == 'd' && cmd->args[i].type != DOUBLE_TYPE)
            return false;        
    }
    return true;
}


void jrun_run_task(taskentry_t *ten, void *arg)
{
    ten->state = TASK_RUNNING;
    
    ten->cback(ten, arg);    
}


tasktable_t *jrun_init()
{
    tasktable_t *tt = (tasktable_t *)calloc(1, sizeof(tasktable_t));
    assert(tt != NULL);
    tt->numtasks = 0;
    
    return tt;
}
