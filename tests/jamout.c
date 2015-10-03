#include "../lib/jamlib/jamlib.h"
#include <stdio.h>
#include <stdlib.h>

int test_sync() {
    JSONObj *j = jsoncreate();
    remotefunctioncall("6gat5r8uxr", "test", j);
}
int jam_start() {
    printf("%d\n", test_sync());
}

int test2(){
    jam_start();
}


int main() {
    int res;

    res = init_jam("localhost", 2500);
    printf("\nReturn code %d \n\n", res);
    
    if (res >= 0) {
    close_application(NULL);
    }
    
    return 0;
}