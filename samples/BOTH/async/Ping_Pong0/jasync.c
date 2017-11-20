#include <stdio.h>

int counter = 0;

jactivity_t* pong();

jasync ping() {
    printf("ping.. %d\n", counter++);
    usleep(5000);
    pong();
}

int main() {
    int i;
    pong();
    return 0;
}
