#include <unistd.h>
#include "jdata.h"
#include "jam.h"

typedef char* jcallback;
jamstate_t *js;
jactivity_t *doubler(int b, jcallback complete) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "doubler", "is",b, complete);
activity_free(jact);
return res;}

void onComplete(char *q) {
printf("%s\n", q);
}
int user_main() {
doubler(3, onComplete);
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
