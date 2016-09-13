#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define ITERATIONS 100
//This benchmark tests mass messaging using sync and async
char *ping_sync(char *);

int main(){
    //Message C2J Sync
    //Javascript Side Function ping_Sync
    int errors = 0;
    for(int i = 0; i < ITERATIONS; i++){
        char *rcv = ping_sync("PING");
        if(strcmp(rcv, "PONG") != 0){
            printf("DAMMIT ROBERT ON C SIDE\n");
            errors++;
        }
        sleep(1);
    }

    for(int i = 0; i < ITERATIONS; i++){
        char *rcv = ping_sync("PING");
        if(strcmp(rcv, "PONG") != 0){
            printf("DAMMIT ROBERT ON C SIDE\n");
            errors++;
        }
    }
    
    printf("Errors: %d\n", errors);
    //Javascript Side Function ping_Asyn
    return 0;
}
