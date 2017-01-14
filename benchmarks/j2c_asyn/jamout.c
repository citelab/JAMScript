#include <unistd.h>
#include "jam.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
typedef char* jcallback;
jamstate_t *js;
jactivity_t *get_rcv_count() {
jactivity_t *res = jam_rexec_async(js, "get_rcv_count", "");
return res;}

int value = 0;
void ping_async(char* msg, int iterations){
if(strcmp(msg, "PING") == 0) {
value++;
}
if(value == iterations) {
get_rcv_count (iterations);
}
}
void callping_async(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
ping_async(cmd->args[0].val.sval, cmd->args[1].val.ival);
}

int user_main() {
printf("Default ...\n");
return 0;
}

void user_setup() {
activity_regcallback(js->atable, "ping_async", ASYNC, "si", callping_async);
}

void jam_run_app(void *arg) {
user_main();
}

void taskmain(int argc, char **argv) {

    js = jam_init(1883);
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }
