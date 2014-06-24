#include "jamlib.h"
#include "application.h"

#include <stdio.h>


int main() 
{
    int res;
    Application *app;

    res = init_jam("localhost", 7777);
    printf("\nReturn code %d \n\n", res);
    
    if (res >= 0) {
	// Register application
	if ((app = create_application("testapp"))) {
	    print_application(app);
	}
	close_application(app);
    }

		
		
	

    // Make function call on the cloud test call_user_def
    // make a reverse call... cloud to thing

    // How about the asynch nature of the call?

    // .. how to handle failure or exceptional behavior after function call??
    // .. jadef c_function() {

    // How about thing - cloud, thing - web, web - cloud, cloud - web,

    return 0;
}
