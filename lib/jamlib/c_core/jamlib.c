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

#include "jamrunner.h"

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
    js->taskdir = jrun_init();

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
    activity_make(js->atable, "testfg", "sii", SYNC);

    
    arg_t *res = jam_rexec_sync(js, "test", "f", 50, 36);
    
    if (res == NULL)
        printf("Nothing come out...\n");
    else
    if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);


    res = jam_rexec_sync(js, "testfg", "f", 1250, 36);
    
    if (res == NULL)
         printf("Nothing come out...\n");
     else
     if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);
        
}


// Start the background processing loop.
//
//
void jam_event_loop(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
    
    while (1) 
    {
        task_wait(js->atable->globalsem);
        nvoid_t *nv = queue_deq(js->atable->globalinq);   
        command_t *cmd = (command_t *)nv->data;
        free(nv);
    
        if (cmd != NULL)
        {
            printf("=============== GOT EVENT %s=========\n", cmd->actname);  
            
            taskentry_t *ten = jrun_find_task(js->taskdir, cmd->actname);
            if (ten == NULL) 
            {
                printf("Function not found.. \n");
            }
            else
            {
                jrun_run_task(ten, cmd);                
            }                      
        }        
        taskyield();        
    }
}


void hellofk(char *s, int x, char *e)
{
    printf("This is Hello from FK function \n");
    printf("Here is the first string: %s, and last string: %s, \nAnd integer: %d\n", s, e, x);
    printf("\n");
}


void callhellofk(void *ten, void *arg)
{
    command_t *cmd = (command_t *)arg;
    hellofk(cmd->args[0].val.sval, cmd->args[1].val.ival, cmd->args[2].val.sval);    
}



void taskmain(int argc, char **argv)
{   
    jamstate_t *js = jam_init();

    jrun_reg_task(js->taskdir, "hellofk", SYNC_TASK, "sis", callhellofk);

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    printf("In main......................... \n");
}
