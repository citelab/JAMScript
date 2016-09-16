#include "command.h"
#include "jdata.h"
#include "jam.h"
#include <limits.h>
typedef char* jcallback;
jamstate_t *js;
int user_main() {
jdata_log_to_server("num_bugs", "32767", ((void*)0));
return 0;
}

void user_setup() {
}

void jam_run_app(void *arg) {
user_main();
}

void taskmain(int argc, char **argv) {

    js = jam_init();
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }
