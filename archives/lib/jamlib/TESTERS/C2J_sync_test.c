#include "jam.h"
#include "command.h"

void jam_run_app(void *arg)
{
    jamstate_t *js = (jamstate_t *)arg;

    int i;

    for (i = 0; i < 100000; i++) {
        printf("############################################ i = %d\n", i);

    arg_t *res = jam_rexec_sync(js, "test", "sii", "f", 50, 36);

    if (res == NULL)
        printf("Nothing come out...\n");
    else{
    if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);
    printf("--------MASTER DEBUGGER IN ACTION---------------\n");
    if (res->type == STRING_TYPE)
        printf("Error code %s\n", res->val.sval);
    }

    command_arg_free(res);
    res = jam_rexec_sync(js, "testfg2", "sii", "f", 1250, 36);

    if (res == NULL)
         printf("Nothing come out...\n");
    else
    if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);
    else
    if (res->type == STRING_TYPE)
        printf("Error code %s\n", res->val.sval);
    command_arg_free(res);
    res = jam_rexec_sync(js, "testfg", "sii", "f", 1250, 36);

    if (res == NULL)
            printf("Nothing come out...\n");
    else
    if (res->type == INT_TYPE)
        printf("*********************************\n HEEEEHAAAAAA... Results = %d \n*********************************\n", res->val.ival);
    else
    if (res->type == STRING_TYPE)
        printf("Error code %s\n", res->val.sval);

    command_arg_free(res);
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
