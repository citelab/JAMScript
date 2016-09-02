#include "jam.h"
#include "duktape/duktape.h"
#include "jdata.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void msg_rcv_custom(void *ten, void *arg){
  jbroadcaster *j = (jbroadcaster *)arg;
  char *result;
  duk_context *ctx = duk_create_heap_default();
  printf("Message Received: %s\n", (char *)get_jbroadcaster_value(j));
  duk_eval_string(ctx, get_jbroadcaster_value(j));
  result = strdup(duk_get_string(ctx, -1));
  jdata_log_to_server("results",result, jdata_default_msg_received); 
  free(result);
  printf("result is: %s\n", duk_get_string(ctx, -1));
  duk_pop(ctx);
  duk_destroy_heap(ctx);
}
void jam_run_app(void *arg){
  jamstate_t *js = arg;
  jdata_get_server_ip(arg);
  printf("Device ID %s\n", js->cstate->conf->device_id);
  jbroadcaster *j = jbroadcaster_init(JBROADCAST_STRING, js->cstate->conf->device_id, msg_rcv_custom);
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
