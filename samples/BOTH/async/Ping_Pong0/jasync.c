#include <stdio.h>

int counter = 0;
int x = 10;

jactivity_t* pong(int c);

jasync ping() {
    printf("ping.. %d\n", counter++);
    usleep(100000);
    pong(x++);
}

int main() {
    int i;
    pong(x++);
    return 0;
}
