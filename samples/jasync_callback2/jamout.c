#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
void testy(jcallback cb){
printf("testy called\n");
cb("ah");
}
void calltesty(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
testy(cmd->args[0].val.sval);
}

int user_main() {
return 0;
}

void user_setup() {
activity_regcallback(js->atable, "testy", ASYNC, "s", calltesty);
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
