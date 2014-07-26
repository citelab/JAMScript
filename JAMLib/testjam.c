#include "jamlib.h"
#include "application.h"
#include <stdio.h>
#include <stdlib.h>

int main() 
{
    int res;
    int code;
    Application *app = NULL;

    res = init_jam("localhost", 2500);
    printf("\nReturn code %d \n\n", res);
    
    if (res >= 0) {
	while(1) {
	    printf("\n1 - Create application \n2 - Open application \n3 - Close application \n4 - Quit\n");
	    scanf("%d", &code);
	    switch (code) {
	    case 1:
		// Register application
		if ((app = create_application("app2")))
		    print_application(app);
		break;
	    case 2:
		if ((app = open_application("app2")))
		    print_application(app);
		break;

	    case 3:
		close_application(app);
		break;
	    default:
		exit(0);
	    }
	}
    }

    return 0;
}
