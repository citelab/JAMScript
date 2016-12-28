#include "jam.h"
#include <unistd.h>

void taskmain(int argc, char *arg[])
{
    jamstate_t *js = jam_init();


    arg_t *res = jam_rexec_sync(js, "resultfunc", "s", "hello");

   // jactivity_t *res = jam_rexec_async(js, "testfunc", "s", "hello");

    //printf("Result %d \n", res->state);

   for (int i = 0; i < 3; i++) 
        command_arg_print(&res[i]);

 //   while(1)
   //     sleep(1);
}


