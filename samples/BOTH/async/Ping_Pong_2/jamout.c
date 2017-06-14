#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"

char app_id[256] = { 0 };
char jdata_buffer[20];
typedef char* jcallback;
jamstate_t *js;
int perank;
jactivity_t *pingserver(int penum) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "true", 0, "pingserver", "i",penum);
activity_free(jact);
return res;
}

jactivity_t *regme(char* msg, jcallback cback) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "true", 0, "regme", "ss",msg, cback);
activity_free(jact);
return res;
}

void regcallback(char *msg) {
if(msg != 0) perank = atoi(msg); else perank = -1;
printf("Perank %d\n", perank);
while(1) {
sleep(1);
printf("Pinging %d\n", perank);
pingserver (perank);
}
}
int user_main() {
printf("Registering...");
regme("hello", "regcallback");
return 0;
}
void callregcallback(void *act, void *arg) {
command_t *cmd = (command_t *)arg;
regcallback(cmd->args[0].val.sval);
}

void user_setup() {
activity_regcallback(js->atable, "regcallback", ASYNC, "s", callregcallback);
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
