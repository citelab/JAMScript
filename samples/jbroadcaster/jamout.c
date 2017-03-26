#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdlib.h>
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
jbroadcaster *y;
int user_main() {
taskdelay(1000);
printf("%i\n", (int)get_jbroadcaster_value(y));
return 0;
}

void user_setup() {
y = jbroadcaster_init(JBROADCAST_STRING, "y", NULL);
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
