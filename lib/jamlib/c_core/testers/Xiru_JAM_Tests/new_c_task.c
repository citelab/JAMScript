#include "jam.h"
#include "command.h"
#include <stdio.h>
#include <string.h>
#include "task.h"

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

    printf("Completing....\n");
    //activity_complete(js->atable, "i", 10);
}

void taskmain(int argc, char **argv)
{
    taskname("mainprogram");
    jamstate_t *js = jam_init();
    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    activity_regcallback(js->atable, "hellofk", SYNC, "sis", callhellofk);

    printf("Commencing JAM operation \n");
}
