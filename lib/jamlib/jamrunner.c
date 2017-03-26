/*

The MIT License (MIT)
Copyright (c) 2017 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY O9F ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

#include "jam.h"
#include "core.h"

#include <task.h>
#include <string.h>
#include "threadsem.h"
#include "jdata.h"
#include "nvoid.h"
#include "mqtt.h"
#include "activity.h"


// Create the runtable that contains all the actid entries
// WARNING:: This table reuses memory based on an LRU scheme.
// It should not slip memory underneath an active allocation. That is
// we should have a situation where the memory is preempted from an
// allocation that is actively used by an activity.

// TODO: Ensure we have memory safety. That is memory is not preempted while
// while being used. It could be a catastropic error to have memory preempted that way. 
//
runtable_t *runtable_new(void *jarg)
{
    int i;

    runtable_t *rtab = (runtable_t *)calloc(1, sizeof(runtable_t));
    
    rtab->jarg = jarg;

    pthread_mutex_init(&(rtab->lock), NULL);
    rtab->entries = (runtableentry_t *)calloc(MAX_RUN_ENTRIES, sizeof(runtableentry_t));

    // Initialize the entries
    for (i = 0; i < MAX_RUN_ENTRIES; i++)
    {
        rtab->entries[i].accesstime = 0;
        rtab->entries[i].status = EMPTY;
    }

    return rtab;
}


runtableentry_t *runtable_find(runtable_t *table, char *actid)
{
    int i, j = -1;

    if (actid == NULL)
        return NULL;

    pthread_mutex_lock(&(table->lock));
    for(i = 0; i < MAX_RUN_ENTRIES; i++)
    {
        if(table->entries[i].status != EMPTY)
            if(strcmp(actid, table->entries[i].actid) == 0)
            {
                j = i;
                break;
            }
    }
    // update the access time of the selected one 
    if (j >= 0) 
        table->entries[j].accesstime = activity_getseconds();

    pthread_mutex_unlock(&(table->lock));

    if (j < 0)
        return NULL;
    else
        return &(table->entries[j]);
}


runtableentry_t *runtable_getfree(runtable_t *table)
{
    int i, j = -1;
    long long minatime = 0;

    pthread_mutex_lock(&(table->lock));
    for(i = 0; i < MAX_RUN_ENTRIES; i++)
    {
        // found an empty slot
        if(table->entries[i].status == EMPTY)
        {
            pthread_mutex_unlock(&(table->lock));
            return &(table->entries[i]);
        }
        else 
        {
            // otherwise.. find the oldest entry.. FIFO in action
            if (minatime > table->entries[i].accesstime)
            {
                minatime = table->entries[i].accesstime;
                j = i;
            }
        }
    }
    pthread_mutex_unlock(&(table->lock));

    return &(table->entries[j]);
}


//
// FIXME: There is something wrong here... why freeing the memory is 
// giving segmentation fault??
//
bool runtable_insert(jamstate_t * js, char *actid, command_t *cmd)
{
    int i;

    // find the entry.. if found no insert
    runtableentry_t *re = runtable_find(js->rtable, actid);
    if (re != NULL)
        return false;

    // else get a free slot and insert the entry in that slot 
    // TODO: FIX: We are searching the table twice..
    //
    re = runtable_getfree(js->rtable);

 //   if (re->actid != NULL)
//        free(re->actid);
    re->actid = strdup(actid);
//    if (re->actname != NULL)
  //      free(re->actname);
    re->actname = strdup(cmd->actname);
    re->cmd = cmd;

    re->accesstime = activity_getseconds();
    re->status = STARTED;
    
    re->exp_replies = js->cstate->mqttenabled[0] + js->cstate->mqttenabled[1] + js->cstate->mqttenabled[2];
    re->rcd_replies = 0;

    for (i = 0; i < MAX_SERVERS; i++)
        re->results[i] = NULL;
    
    return true;
}


bool runtable_del(runtable_t *tbl, char *actid)
{
    // find the entry.. if not found return with false
    runtableentry_t *re = runtable_find(tbl, actid);
    if (re == NULL)
        return false;

    if (re->actid != NULL)
        free(re->actid);
    if (re->actname != NULL)
        free(re->actname);
 //   command_free(re->cmd);

    re->accesstime = 0;
    re->status = EMPTY;

    return true;
}


// Store results.. in an entry that is already there..
//
bool runtable_store_results(runtable_t *tbl, char *actid, arg_t *results)
{
    // Access the entry.. return false if the entry is not found
    runtableentry_t *re = runtable_find(tbl, actid);
    if (re == NULL)
        return false;

    pthread_mutex_lock(&(tbl->lock));
    // If max replies are already received.. just over write the old ones
    if (re->rcd_replies < MAX_SERVERS)
        re->results[re->rcd_replies++] = results;
    else 
    {
        free(re->results[re->rcd_replies]);
        re->results[re->rcd_replies] = results;
    }
    pthread_mutex_unlock(&(tbl->lock));

    return true;
}


void runtable_insert_synctask(jamstate_t *js, command_t *rcmd, int quorum)
{
    

}


int runtable_synctask_count(runtable_t *rtbl)
{

    return 0;
}



command_t *get_actid_results(jamstate_t *js, char *actid)
{
    command_t *scmd = NULL;
    int i;

    char *deviceid = js->cstate->device_id;

    #ifdef DEBUG_LVL1
        printf("Dev ID id %s\n", deviceid);
    #endif

    // find the entry.. if not found return a command that indicates not found
    runtableentry_t *ren = runtable_find(js->rtable, actid);
    if (ren == NULL)
    {
        scmd = command_new("REXEC-RES", "ERR", "-", 0, "-", actid, deviceid, "");
        return scmd;
    }

    // create the command to reply with the status update..
    // send [[ REXEC-RES FIN actname deviceid actid res (arg0)] (res is a single object) or
    //
    if (ren->status == COMPLETED)
    {
        if (ren->results[0] == NULL)
        {
            scmd = command_new("REXEC-RES", "EMP", "-", 0, ren->actname, actid, deviceid, "");
            return scmd;
        }

        switch (ren->results[0]->type)
        {
            case STRING_TYPE:
                scmd = command_new("REXEC-RES", "RES", "-", 0, ren->actname, actid, deviceid, "s", ren->results[0]->val.sval);
            break;

            case INT_TYPE:
                scmd = command_new("REXEC-RES", "RES", "-", 0, ren->actname, actid, deviceid, "i", ren->results[0]->val.ival);
            break;

            case DOUBLE_TYPE:
                scmd = command_new("REXEC-RES", "RES", "-", 0, ren->actname, actid, deviceid, "d", ren->results[0]->val.dval);
            break;

            case NVOID_TYPE:
                scmd = command_new("REXEC-RES", "RES", "-", 0, ren->actname, actid, deviceid, "b", ren->results[0]->val.nval);
            break;
            case NULL_TYPE:
            break;
        }
        return scmd;
    }
    else 
    {
        scmd = command_new("REXEC-RES", "CNT", "-", 0, ren->actname, actid, deviceid, "");
        return scmd;
    }
}



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


void jrun_arun_callback(jactivity_t *jact, command_t *cmd, activity_callback_reg_t *creg)
{
    // Activity to run the callback is already created..
    // No need to create it again...
    //

    #ifdef DEBUG_LVL1
        printf("Starting the function....................\n");
    #endif

    creg->cback(jact, cmd);    
    // if the execution was done due to a remote request...
    if (jact->remote)
        // Delete the activity.. because we are doing a remote processing..
        activity_free(jact);

    // Don't free cmd here.. it should be freed in the calling function..
}

