#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdlib.h>
#include <stdio.h>
char app_id[256] = { 0 };
char jdata_buffer[20];
typedef char* jcallback;
jamstate_t *js;
jbroadcaster *y;
double load[1];
int user_main() {
char str[15];
while(1) {
getloadavg(load, 1);
snprintf(str, 15, "%f", load[0]);
sprintf(jdata_buffer, "%i", str);
jamdata_log_to_server("global", "x", jdata_buffer, ((void*)0));
taskdelay(100);
if(atoi(get_jbroadcaster_value(y)) == 1) {
printf("System overloaded, now quitting...\n");
break;
}
}
return 0;
}

void user_setup() {
y = jambroadcaster_init(JBROADCAST_INT, "global", "y", NULL);
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
