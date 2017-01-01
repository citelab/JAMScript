#include "jam.h"
#include <unistd.h>


void hello(char* msg) {

        printf("\n\n ===============>>> FROM HELLO ==========: %s\n", msg);
}

void hello3(char* msg) {

    while(1)
    {
        printf("\n\n ===============>>> FROM HELLO33333 ==========: %s\n", msg);
        usleep(1000);
        taskyield();
    }
}


void callhello(void *act, void *arg) 
{
    command_t *cmd = (command_t *)arg;
    hello(cmd->args[0].val.sval);
}

void callhello3(void *act, void *arg) 
{
    command_t *cmd = (command_t *)arg;
    hello3(cmd->args[0].val.sval);
}

jamstate_t *js;

void user_setup() {
    printf("Registering.. callbacks for hello and hello3.. \n");
    activity_regcallback(js->atable, "hello", ASYNC, "s", callhello);
    activity_regcallback(js->atable, "hello3", ASYNC, "s", callhello3);
}


void taskmain(int argc, char *arg[])
{
    int port = 1883;
    if (argc == 2)
        port = atoi(arg[1]);

    js = jam_init(port);
    
    user_setup();

  //  arg_t *res = jam_rexec_sync(js, "resultfunc", "s", "hello");

   // jactivity_t *res = jam_rexec_async(js, "testfunc", "s", "hello");

    //printf("Result %d \n", res->state);

   //for (int i = 0; i < 3; i++) 
     //   command_arg_print(&res[i]);

     printf("Starting the event loop...");
     taskcreate(jam_event_loop, (void *)js, 10000);
     taskyield();
     printf("Waiting...\n");
    while(1) 
    {
        usleep(100);
        taskyield();
    }
}


