#include <stdio.h>

int counter = 0;

jactivity_t* pong();

jasync ping() {
    printf("ping.. %d\n", counter++);
    pong();
}

int main() {
    ping();
    return 0;
}
