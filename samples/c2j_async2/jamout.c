#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdio.h>
char app_id[256] = { 0 };
char jdata_buffer[20];
typedef char* jcallback;
jamstate_t *js;
void ping(char* name){
printf("Ping receive from: %s\n", name);
}
void callping(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
ping(cmd->args[0].val.sval);
}

int user_main() {
return 0;
}

void user_setup() {
activity_regcallback(js->atable, "ping", ASYNC, "s", callping);
}

void jam_run_app(void *arg) {
user_main();
}

void taskmain(int argc, char **argv) {

    if (argc > 1) {
      strncpy(app_id, argv[1], sizeof app_id - 1);
    }
    js = jam_init(1883);
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }
