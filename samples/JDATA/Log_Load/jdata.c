#include <stdlib.h>
#include <stdio.h>

double load[1];
int main() {
    char str[15];
    while(true) {
        getloadavg(load, 1);
        snprintf(str, 15, "%f", load[0]);
        x = str;
        taskdelay(100);
        if(y == 1) {
            printf("System overloaded, now quitting...\n");
            break;
        }
    }
    // printf("load average : %f , %f , %f\n", load[0],load[1],load[2]);
    return 0;
}
