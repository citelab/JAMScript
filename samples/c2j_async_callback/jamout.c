#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
jactivity_t *print_msg(char* msg, jcallback cb) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "true", 0,  "print_msg", "ss",msg, cb);
activity_free(jact);
return res;}

void cbf(char *abc) {
printf("I should be in C... Message received\n");
}
int user_main() {
print_msg("I should print in J node.......", "cbf");
return 0;
}
void callcbf(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
cbf(cmd->args[0].val.sval);
}

void user_setup() {
activity_regcallback(js->atable, "cbf", ASYNC, "s", callcbf);
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
