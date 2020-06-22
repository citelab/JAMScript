#include <stdio.h>

// #define SLEEP
#ifdef SLEEP
int N = 1; // iterations
int T = 500; // milliseconds
#endif

jsync int j2c_sync(char* id) {
    printf("J2C sync activity called from fog %s\n", id);
    #ifdef SLEEP
    for (int i = 0; i < N; i++) {
        printf("Working on iteration %d\n", i);
        jsleep(T);
    }
    #endif
    return 0;
}

jsync_ctx int j2c_sync_ctx(char* id) {
    printf("J2C sync activity called from fog %s\n", id);
    #ifdef SLEEP
    for (int i = 0; i < N; i++) {
        printf("Working on iteration %d\n", i);
        jsleep(T);
    }
    #endif
    return 0;
}

int main(int argc, char* argv[]) {
    return 0;
}
