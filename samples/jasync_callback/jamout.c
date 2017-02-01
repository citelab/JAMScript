#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
jactivity_t *print_msg(char* msg, jcallback cb) {
jactivity_t *jact = jam_create_activity(js);
jactivity_t *res = jam_rexec_async(js, jact, "print_msg", "ss",msg, cb);
activity_free(jact);
return res;}

void cb() {
printf("Message received\n");
}
int user_main() {
print_msg("test", cb);
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
