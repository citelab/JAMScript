#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdio.h>
char app_id[256] = { 0 };
char jdata_buffer[20];
typedef char* jcallback;
jamstate_t *js;
jactivity_t *pong() {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "true", 0, "pong", "");
activity_free(jact);
return res;}

int user_main() {
long long btime;
int i;
while(1) {
pong();
}
}

void user_setup() {
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
