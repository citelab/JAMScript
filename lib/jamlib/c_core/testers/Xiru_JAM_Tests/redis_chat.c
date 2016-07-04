#include "jam.h"
#include "jdata.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void msg_rcv_custom(redisAsyncContext *c, void *reply, void *privdata){
  redisReply *r = reply;
  if (reply == NULL) return;
  if (r->type == REDIS_REPLY_ARRAY) {
      for (int j = 2; j < r->elements; j++) {
          printf("Message Received: %s\n",r->element[j]->str);
      }
  }
}

void jam_run_app(void *arg){
  char *buf;
  int len = 0;
  jdata_get_server_ip(arg);
  printf("Chat Service Initiated ... \n");
  jdata_subscribe_to_server("chat_channel_1", msg_rcv_custom, NULL, NULL);
  while(1){
    getline(&buf, &len, stdin);
    buf[strlen(buf) - 1] = '\0';
    jdata_log_to_server("chat_channel_1", buf, NULL);
    len = 0;
    free(buf);
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
    printf("Commencing JAM operation \n");
}
