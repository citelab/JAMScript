#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
int i = 0;
long long qtime = 0;
void ping(){
printf("In ping...i = %d\n", i);
}
void callping(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
ping();
}

int user_main() {
printf("C program started... \n");
}

void user_setup() {
activity_regcallback(js->atable, "ping", ASYNC, "", callping);
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
