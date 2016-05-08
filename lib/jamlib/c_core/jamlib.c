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

#include "jamlib.h"
#include "core.h"

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

    // Callback initialization
    js->callbacks = callbacks_new();
    js->atable = activity_table_new();

    // Queue initialization
    // globalinq is used by the main thread for input purposes
    // globaloutq is used by the main thread for output purposes
    js->atable->globalinq = queue_new(true);
    js->atable->globaloutq = queue_new(true);

    js->atable->globalsem = threadsem_new();

    js->maintimer = timer_init("maintimer");
    
    js->bgsem = threadsem_new();

    int rval = pthread_create(&(js->bgthread), NULL, jamworker_bgthread, (void *)js);
    if (rval != 0) {
        perror("ERROR! Unable to start the jamworker thread");
        exit(1);
    }
    
    task_wait(js->bgsem);
    
    #ifdef DEBUG_LVL1
        printf("\t\t Done.");
    #endif 
    return js;
}


void jam_run_app(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
            
    activity_make(js->atable, "test", "sii", SYNC);
    
    jam_rexec_sync(js, "test", "f", 20, 10);
        
}


// Start the background processing loop.
//
//
void jam_event_loop(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    event_t *e = NULL;

    while ((e = jam_get_event(js))) {
        if (e != NULL)
        {
            printf("=============== GOT EVENT %s=========\n", e->actname);
         //   callbacks_call(js->callbacks, js, e);
        }
        else
            taskexit(0);

        taskyield();
    }
}


// TODO: This needs to revamped. Timeouts come here too.
// The RPC processing is complicated.. it could have changes here too.
// TODO: Add many different types of events here with the new design!
//
//
event_t *jam_get_event(jamstate_t *js)
{
    task_wait(js->atable->globalsem);
    command_t *cmd = (command_t *)queue_deq(js->atable->globalinq);

    if (cmd == NULL)
        return NULL;

    if (cmd->cmd == NULL)
        return NULL;

    // TODO: This needs to be fixed ASAP!
    return event_complete_new(cmd->actname, NULL, "temp");
}


void jam_reg_callback(jamstate_t *js, char *aname, eventtype_t etype, event_callback_f cb, void *data)
{
    callbacks_add(js->callbacks, aname, etype, cb, data);
}



void taskmain(int argc, char **argv)
{   
    jamstate_t *js = jam_init();

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    printf("In main......................... \n");
}
