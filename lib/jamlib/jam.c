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
jamstate_t *jam_init(int port)
{
    #ifdef DEBUG_LVL1
        printf("JAM Library initialization... ");
    #endif

    jamstate_t *js = (jamstate_t *)calloc(1, sizeof(jamstate_t));

    // TODO: Should we remove the hardcoded timeout values? To which value?
    js->cstate = core_init(port, 100);

    if (js->cstate == NULL)
    {
        printf("ERROR!! Core Init Failed. Exiting.\n");
        exit(1);
    }

    // Initialization of the activity and task tables
    js->atable = activity_table_new();
    js->rtable = jwork_runtable_new();

    // Queue initialization
    js->deviceinq = queue_new(true);
    js->foginq = queue_new(true);
    js->cloudinq = queue_new(true);


    js->bgsem = threadsem_new();
    js->jdata_sem = threadsem_new();

    int rval = pthread_create(&(js->bgthread), NULL, jwork_bgthread, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jamworker thread");
        exit(1);
    }
    printf("\n\n--------------PLEASE WORK---------------\n\n");
    task_wait(js->bgsem);

    // rval = pthread_create(&(js->jdata_event_thread), NULL, jdata_event_loop, (void *)js);
    // if (rval != 0) {
    //     perror("ERROR! Unable to start the jdata event thread");
    //     exit(1);
    // }
    // task_wait(js->jdata_sem);

    //#ifdef DEBUG_LVL1
        printf("\n ------------------------Done-------------------------\n");
    //#endif
    return js;
}


// Start the background processing loop.
//
//
void jam_event_loop(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    command_t *cmd;

    while (1)
    {
        nvoid_t *nv = pqueue_deq(js->atable->globalinq);
        printf("Got a message for the event loop...  \n");
        if (nv != NULL)
        {
            cmd = (command_t *)nv->data;
            free(nv);
        } else
            cmd = NULL;

        if (cmd != NULL)
        {
            // Put all conditions under which we could ask a new activity to continue
            if ((strcmp(cmd->cmd, "REXEC-ASY") == 0) ||
                (strcmp(cmd->cmd, "REXEC-SYN") == 0)) 
            {
                jactivity_t *jact = activity_new(js->atable, cmd->actid);
                if (jact != NULL)
                    pqueue_enq(jact->inq, cmd, sizeof(command_t));
                else
                    printf("ERROR! Unable to find a free Activity handler to start %s", cmd->actname);
            }
        }
        taskyield();
    }
}

