#include "../lib/jamlib/jamlib.h"
    #include <stdio.h>
    #include <stdlib.h>
Application *app = NULL;
void test_load() {execute_remote_func(app, "test_load", "");}
void bad_load() {execute_remote_func(app, "bad_load", "");}void bad_error(struct Application *app,Event *e,void *data){printf("Error received\n");}
int jam_start(){
    int code;
    int loop = 1;
    while(loop) {
        printf("Your choice: \n \
                        1 - Execute hello \n \
                        2 - Trigger error \n \
                        3 - Quit \n");
        scanf("%d", & code);
        switch(code){
            case 1:test_load();
            break;
            case 2:bad_load();
            break;
            case 3:loop = 0;
            break;    }
            }
    
    return 0;    }


int main() {
    int res;
    char appname[16] = "jamout";

    // Connect and setup JAMLib..
    int rval = init_jam("localhost", 2500);
    if (rval < 0) {
        printf("ERROR! JAMLib initialization failed\n");
        exit(1);
    }

    app = open_application(appname);
    if (app == NULL) {
        printf("ERROR! Unable to open/create the application \n");
        printf("JAMLib server may be crashed.. \n");
        exit(1);
    }
register_callback(app, "wc70xqiwwmi", ErrorEventType, bad_error, NULL);
bg_event_loop(app);

    jam_start();

    close_application(app);
    return 0;
    }