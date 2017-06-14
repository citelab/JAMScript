#include <unistd.h>
#include "jdata.h"
#include "command.h"
#include "jam.h"
#include <stdlib.h>
#include <stdio.h>
jamstate_t *js;
typedef char* jcallback;
char jdata_buffer[20];
char app_id[256] = { 0 };
jbroadcaster *overloadedBroadcast;
double load[1];
int user_main() {
	char str[15];
	while(1) {
		getloadavg(load, 1);
		printf("CPU at: %f\n", load[0]);
		sprintf(jdata_buffer, "%f", load[0]);
		jamdata_log_to_server("global", "cpuLog", jdata_buffer, ((void*)0));
		taskdelay(100);
		if(atoi(get_jbroadcaster_value(overloadedBroadcast)) == 1) {
			printf("System overloaded, now quitting...\n");
			exit(0);
		}
	}
	return 0;
}

void user_setup() {
	overloadedBroadcast = jambroadcaster_init(JBROADCAST_INT, "global", "overloadedBroadcast", NULL);
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
