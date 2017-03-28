#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"

typedef char* jcallback;
jamstate_t *js;
int user_main() {
printf("Hello\n");
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
