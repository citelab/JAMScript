#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <limits.h>
typedef char* jcallback;
jamstate_t *js;
jbroadcaster *stuff;
int user_main() {
printf("We are here ... \n");
return 0;
}

void user_setup() {
stuff = jbroadcaster_init(JBROADCAST_STRING, "stuff", NULL);
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
