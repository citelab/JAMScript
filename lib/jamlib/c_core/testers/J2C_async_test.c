#include "jam.h"
#include "command.h"

void hellofk(char *s, int x, char *e)
{
    printf("This is Hello from FK function \n");
    printf("Here is the first string: %s, and last string: %s, \nAnd integer: %d\n", s, e, x);
    printf("\n");
}


void callhellofk(void *act, void *arg)
{
    command_t *cmd = (command_t *)arg;
    hellofk(cmd->args[0].val.sval, cmd->args[1].val.ival, cmd->args[2].val.sval);
}


void taskmain(int argc, char **argv)
{
    jamstate_t *js = jam_init();

    activity_regcallback(js->atable, "hellofk", ASYNC, "sis", callhellofk);

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    //taskcreate(jam_run_app, js, STACKSIZE);
    printf("In main......................... \n");
}
