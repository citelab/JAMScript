#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"

char app_id[256] = { 0 };
char jdata_buffer[20];
typedef char* jcallback;
jamstate_t *js;
jactivity_t *doubler(int b, jcallback complete) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "true", 0, "doubler", "is",b, complete);
activity_free(jact);
return res;}

void onComplete(char *q) {
printf("%s\n", q);
}
int user_main() {
doubler(3, "onComplete");
return 0;
}
void callonComplete(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
onComplete(cmd->args[0].val.sval);
}

void user_setup() {
activity_regcallback(js->atable, "onComplete", ASYNC, "s", callonComplete);
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
