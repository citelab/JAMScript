#include <unistd.h>
#include "jam.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#define ITERATIONS 100
typedef char* jcallback;
jamstate_t *js;
jactivity_t *ping_asyn(char* msg) {
jactivity_t *res = jam_rexec_async(js, "ping_asyn", "s",msg);
return res;}

int get_num_ping() {
arg_t *res = jam_rexec_sync(js, "get_num_ping", "");
int ret = res->val.ival;
command_arg_free(res);
return ret;
}

int user_main() {
int errors = 0;
for (int i = 0; i < 100; i++) {
ping_asyn("PING");
sleep(1);
}
errors += get_num_ping();
if(errors != 100) {
printf("Error: %d", 100 - errors);
}
for (int i = 0; i < 100; i++) {
ping_asyn("PING");
}
errors += get_num_ping();
if(errors != 100 >> 2) {
printf("Error: %d", (100 << 2) - errors);
}
printf("Errors: %d\n", errors);
return 0;
}

void user_setup() {
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
