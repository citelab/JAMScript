#include "../lib/jamlib/jamlib.h"
#include <stdio.h>
#include <stdlib.h>

void error_callback(struct Application *app, Event *e, void *data)
{
    printf("Error Event received\n - type %d\n - activity %s\n", e->type, e->actname);
    printf("Number of elements in the event: %d\n", e->val.error.ecode->val.aval->length);

}

void complete_callback(struct Application *app, Event *e, void *data)
{
    printf("Complete Event received\n - type %d\n - activity %s\n", e->type, e->actname);
    printf("Number of elements in the event: %d\n", e->val.comp.rval->val.aval->length);
}

void cancel_callback(struct Application *app, Event *e, void *data)
{
    printf("Cancel Event received\n - type %d\n - activity %s\n", e->type, e->actname);
}

void verify_callback(struct Application *app, Event *e, void *data)
{
    printf("Verify Event received\n - type %d\n - activity %s\n", e->type, e->actname);
}



int main()
{
    int code;
    char appname[16];
    Application *app = NULL;

    int x;

    printf("Enter app name: "); scanf("%s", appname);

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
    register_callback(app, "activity-name", ErrorEventType, error_callback, NULL);
    register_callback(app, "activity-name", CompleteEventType, complete_callback, NULL);
    register_callback(app, "activity-name", CancelEventType, cancel_callback, NULL);
    register_callback(app, "activity-name", VerifyEventType, verify_callback, NULL);

    bg_event_loop(app);

    // User processing..
    int loop = 1;
    while(loop) {
        printf("Your choice: \n \
                1 - Print app info \n \
                2 - Execute hello \n \
                3 - Raise event.. \n \
                4 - Quit \n");

        scanf("%d", &code);
        switch (code) {
            case 1:
                print_application(app);
                break;
            case 2:
                execute_remote_func(app, "hello", "\"%s\" %d", "test", 121);
                break;
            case 3:
                x = raise_event(app, "activity-tag", ErrorEventType, "xfdfd", "sii", "london", 232, 3433);
                if (x != 0)
                    printf("ERROR! Raising the event..\n");
                break;
            case 4:
                loop = 0;
                break;
        }
    }

    // merge with the background thread..
    close_application(app);
    return 0;
}
