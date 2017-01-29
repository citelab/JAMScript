#include "jam.h"
#include <unistd.h>


void hello(char* msg) {

        printf("\n\n ===============>>> FROM HELLO ==========: %s\n", msg);
}

void hello3(char* msg) {

        printf("\n\n ===============>>> FROM HELLO33333 ==========: %s\n", msg);
        usleep(1000);
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
    activity_regcallback(js->atable, "testfunc", ASYNC, "s", callhello3);
    
}


void taskmain(int argc, char *arg[])
{
    int port = 1883;
    int xx;
    if (argc == 2)
        port = atoi(arg[1]);

    js = jam_init(port);
    
    user_setup();

    printf("Device ID %s\n", js->cstate->device_id);



     printf("Starting the event loop...");
     taskcreate(jam_event_loop, (void *)js, 10000);
     taskyield();
     printf("Waiting...\n");



     int i = 0;


    while(1) 
    {
      jactivity_t *jact = jam_create_activity(js);
      jactivity_t *res = jam_rexec_async(js, jact, "testfunc", "s", "hello");
      usleep(1000);
      activity_free(jact);
      taskyield();
      printf("Hello\n");
    }
}


