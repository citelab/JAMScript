#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

jactivity_t *get_rcv_count();
int value = 0;

jasync ping_async(char *msg, int iterations){
    if(strcmp(msg, "PING") == 0){
        value++;
    }
    if(value == iterations){
        get_rcv_count(iterations);
    }
}

int main(){
    printf("Default ...\n");
    return 0;
}