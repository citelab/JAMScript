#include "jam.h"
#include "jdata.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void msg_rcv_custom(void *j){
  jbroadcaster *x = (jbroadcaster *)j;
  printf("%s = %s\n", x->key, x->data);
}

void jam_run_app(void *arg){
  jamstate_t *js = arg;
  jdata_get_server_ip(arg);
  jshuffler *j = jshuffler_init(0, "Life", NULL);
  jshuffler_push(j, "First run ...");
  sleep(1);
  jshuffler_poll(j);
  sleep(1);
  jshuffler_poll(j);
  jshuffler_push(j, "Second run ...");
  jdata_log_to_server("testing", "heeeeeeeey", NULL);
  printf("Hey ... \n");
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
