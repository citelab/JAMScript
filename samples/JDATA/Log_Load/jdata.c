#include <stdlib.h>
#include <stdio.h>

double load[1];
int main() {
    char str[15];
    while(true) {
        getloadavg(load, 1);
        printf("CPU at: %f\n", load[0]);
        cpuLog = load[0];
        taskdelay(100);
        if(overloadedBroadcast == 1) {
            printf("System overloaded, now quitting...\n");
            exit(0);
        }
    }
    // printf("load average : %f , %f , %f\n", load[0],load[1],load[2]);
    return 0;
}
