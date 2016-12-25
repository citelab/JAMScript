#include "jam.h"

void taskmain(int argc, char *arg[])
{
    jamstate_t *js = jam_init();


    jactivity_t *res = jam_rexec_async(js, "testfunc", "s", "hello");

    printf("Status %d\n", res->state);

    while(1)
        sleep(1);
}


