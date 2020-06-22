#include <stdio.h>
#include <stdlib.h>

char* c2j_sync(int);
int n = 0;

jasync j2c_async(char* id) {
    printf("J2C async activity called from fog %s\n", id);
}

jsync_ctx int j2c_sync_ctx(char* id) {
    printf("J2C sync activity called from fog %s\n", id);
    jsleep(2000);
    char* v = c2j_sync(1);
    printf("C2J sync (inContext=1) returned %s\n", v);
    free(v);
    jsleep(8000);
    return n++;
}

jasync loop() {
    while (1) {
        x = "C";
        jsleep(3000);
    }
}

jasync read_last_ctx() {
    jsleep(30000);
    char* v = c2j_sync(0);
    printf("C2J sync (inContext=0) returned %s\n", v);
    free(v);
}

int main(int argc, char* argv[]) {
    loop();
    read_last_ctx();
    return 0;
}
