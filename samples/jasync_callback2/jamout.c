#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
jactivity_t *firstcall(char* str) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "firstcall", "s",str);
activity_free(jact);
return res;}

void testy(jcallback cb){
printf("testy called\n");
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, cb, "%s", "ah");
activity_free(jact);
;
}
void calltesty(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
testy(cmd->args[0].val.sval);
}

int user_main() {
firstcall("Hello");
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
