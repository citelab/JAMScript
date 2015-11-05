#include "../lib/jamlib/jamlib.h"
#include <stdio.h>


int main() {
    int res;

    res = init_jam("localhost", 2500);
    printf("\nReturn code %d \n\n", res);
    
    if (res >= 0) {

    // Register application

    // Make function call on the cloud test call_user_def
    // make a reverse call... cloud to thing

    // How about the asynch nature of the call?

    // .. how to handle failure or exceptional behavior after function call??
    // .. jadef c_function() {

    // How about thing - cloud, thing - web, web - cloud, cloud - web,

	close_application(NULL);
    }
    
    return 0;
}
