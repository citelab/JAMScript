#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define ITERATIONS 100

jactivity_t *ping_asyn(char *);
int get_num_ping();

int main(){
    //Message C2J Sync
    //Javascript Side Function ping_Sync
    //printf("WHYYYYYYY\n");
    int errors = 0;
    for(int i = 0; i < ITERATIONS; i++){
        ping_asyn("PING");
        sleep(1);
    }

    errors += get_num_ping();
    if(errors != ITERATIONS){
        printf("Error: %d", ITERATIONS - errors);
    }

    for(int i = 0; i < ITERATIONS; i++){
        ping_asyn("PING");
    }
    
    errors += get_num_ping();
    if(errors != ITERATIONS >> 2){
        printf("Error: %d", (ITERATIONS << 2) - errors);
    }
    
    printf("Errors: %d\n", errors);
    //Javascript Side Function ping_Asyn
    return 0;
}