#include "jam.h"
#include "command.h"
#include <stdlib.h>

#define FAILURE 1
#define BUSY 2
#define FREE 3



void jam_run_app(void *arg)
{
    //Okay so here, we simulate hill climbing and attempt to find the highest value given a large array
    jamstate_t *js = (jamstate_t *)arg;
    char status_msg[256];
    while(1){
      jam_rexec_async(js, "process_status", "si", "f", 1);
      sleep(1);
    }
}


void taskmain(int argc, char **argv)
{
    jamstate_t *js = jam_init();

    // Start the event loop in another thread.. with cooperative threads.. we
    // to yield for that thread to start running
    taskcreate(jam_event_loop, js, STACKSIZE);

    // create the application runner
    taskcreate(jam_run_app, js, STACKSIZE);
    printf("Commencing JAM operation \n");
}
