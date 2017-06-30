#include "jam.h"
#include "command.h"

void jam_run_app(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;


    int i;

    for (i = 0; i <20; i++)
    {
        printf("############################################ i = %d\n", i);

        jactivity_t *res = jam_rexec_async(js, "test", "sii", "f", 50, 36);
        if (res == NULL)
            printf("Some error occuredd...\n");
        else
        if (res->state == NEW)
            printf("A new activity created...  \n");
        else
            printf("Some other error....%d\n", res->state);

        res = jam_rexec_async(js, "testfg2", "sii", "f", 50, 36);
        if (res == NULL)
            printf("Some error occuredd...\n");
        else
        if (res->state == NEW)
            printf("A new activity created...  \n");
        else
            printf("Some other error....%d\n", res->state);

        res = jam_rexec_async(js, "testfg", "sii", "f", 50, 36);
        if (res == NULL)
            printf("Some error occuredd...\n");
        else
        if (res->state == NEW)
            printf("A new activity created...  \n");
        else
            printf("Some other error....%d\n", res->state);
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
    printf("In main......................... \n");
}
