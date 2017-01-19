#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef char* jcallback;
jamstate_t *js;
int user_main() {
jdata_log_to_server("x", "4", ((void*)0));
jdata_log_to_server("y", "0", ((void*)0));
js_read();
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
