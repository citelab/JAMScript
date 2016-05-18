#include "task.h"
#include "jam.h"


void taskmain(int argc, char *argv[])
{
    jamstate_t *js = jam_init();

    // code from the "main" of the app
    // we can have sync and async activities here in the app code.
    // we directly call the sync activities

    // we spawn a thread for async activities





    // mark as system task.. so we don't hang around for it completion
    tasksystem();

    // we wait for all other computing threads to exit..
    while(1)
        taskdelay(100);
}
