#include "jam.h"
#include "duktape/duktape.h"
#include "jdata.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void msg_rcv_custom(redisAsyncContext *c, void *reply, void *privdata){
  redisReply *r = reply;
  char *result;
  if (reply == NULL) return;
  if (r->type == REDIS_REPLY_ARRAY) {
      for (int j = 2; j < r->elements; j++) {
          if(r->element[j]->str != NULL){
            duk_context *ctx = duk_create_heap_default();
            printf("Message Received: %s\n",r->element[j]->str);
            duk_eval_string(ctx, r->element[j]->str);
            result = strdup(duk_get_string(ctx, -1));
            jdata_log_to_server("results",result, jdata_default_msg_received);
            free(result);
            printf("result is: %s\n", duk_get_string(ctx, -1));
            duk_pop(ctx);
            duk_destroy_heap(ctx);
        }
      }
  }
}

void jam_run_app(void *arg){
  jamstate_t *js = arg;
  char buf[256];
  int len = 0;
  redisReply *r;
  printf("Device ID %s\n", js->cstate->conf->device_id);
  jdata_subscribe_to_server(js->cstate->conf->device_id, msg_rcv_custom, NULL, NULL);
  jdata_get_server_ip(arg);
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
