/*

The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

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
#include "activity.h"

#ifdef linux
#include <bsd/stdlib.h>
#endif

#include "jdata.h"
#include <strings.h>
#include <pthread.h>


// Initialize the JAM library.. nothing much done here.
// We just initialize the Core ..
//
jamstate_t *jam_init()
{
    #ifdef DEBUG_LVL1
        printf("JAM Library initialization... ");
    #endif

    jamstate_t *js = (jamstate_t *)calloc(1, sizeof(jamstate_t));

    // TODO: Remove the hardcoded timeout values
    // 200 milliseconds timeout now set
    js->cstate = core_init(10000);
    if (js->cstate == NULL)
    {
        printf("ERROR!! Core Init Failed. Exiting.\n");
        exit(1);
    }

    // Initialization of the activity and task tables
    js->atable = activity_table_new();

    js->rtable = jwork_runtable_new();

    // Queue initialization
    // globalinq is used by the main thread for input purposes
    // globaloutq is used by the main thread for output purposes
    js->atable->globalinq = queue_new(true);
    js->atable->globaloutq = queue_new(true);

    js->atable->globalsem = threadsem_new();
    js->atable->delete_sem = threadsem_new();

    js->maintimer = timer_init("maintimer");

    js->bgsem = threadsem_new();
    js->jdata_sem = threadsem_new();
    //jcond_read_context();

    int rval = pthread_create(&(js->bgthread), NULL, jwork_bgthread, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jamworker thread");
        exit(1);
    }
    //printf("\n\n--------------PLEASE WORK---------------\n\n");
    task_wait(js->bgsem);
    rval = pthread_create(&(js->jdata_event_thread), NULL, jdata_event_loop, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jdata event thread");
        exit(1);
    }
    task_wait(js->jdata_sem);
    #ifdef DEBUG_LVL1
        printf("\n ------------------------Done.-------------------------\n");
    #endif
    return js;
}


// Start the background processing loop.
//
//
void jam_event_loop(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    temprecord_t *tr;
    command_t *cmd;
    activity_callback_reg_t *areg;

    while (1)
    {
        task_wait(js->atable->globalsem);
        nvoid_t *nv = queue_deq(js->atable->globalinq);
        if (nv != NULL)
        {
            cmd = (command_t *)nv->data;
            free(nv);
        } else
            cmd = NULL;

        if (cmd != NULL)
        {
            areg = activity_findcallback(js->atable, cmd->actname, cmd->opt);
            if (areg == NULL)
            {

                printf("Function not found.. %s\n", cmd->actname);
            }
            else
            {
                #ifdef DEBUG_LVL1
                printf("Command actname = %s %s %s\n", cmd->actname, cmd->cmd, cmd->opt);
                #endif

                tr = jam_newtemprecord(js, cmd, areg);
                taskcreate(jrun_run_task, tr, STACKSIZE);
                #ifdef DEBUG_LVL1
                printf(">>>>>>> After task create...cmd->actname %s\n", cmd->actname);
                #endif
            }
        }
        taskyield();
    }

}


temprecord_t *jam_newtemprecord(void *arg1, void *arg2, void *arg3)
{
    temprecord_t *trec = (temprecord_t *)calloc(1, sizeof(temprecord_t));
    assert(trec != NULL);
    trec->arg1 = arg1;
    trec->arg2 = arg2;
    trec->arg3 = arg3;

    return trec;
}
