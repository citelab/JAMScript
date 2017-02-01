#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
jactivity_t *doubler(int b) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "doubler", "i",b);
activity_free(jact);
return res;}

int user_main() {
int i;
for (i = 0; i < 200; i++) {
printf("Calling doubler..\n");
doubler (i);
}
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
