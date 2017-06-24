#include "jam.h"
#include "command.h"

void jam_run_app(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;
            
    activity_make(js->atable, "test", "sii", SYNC);
    activity_make(js->atable, "testfg2", "sii", SYNC);
    
    arg_t *res = jam_rexec_sync(js, "test", "f", 50, 36);
    
    if (res == NULL)
        printf("Nothing come out...\n");
    else
    if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);


    res = jam_rexec_sync(js, "testfg2", "f", "1250", 36);
    
    if (res == NULL)
         printf("Nothing come out...\n");
    else
    if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);
    else
    if (res->type == STRING_TYPE)
        printf("Error code %s\n", res->val.sval);
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
