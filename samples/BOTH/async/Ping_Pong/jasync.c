#include <stdio.h>

int counter = 0;

jactivity_t* pong();

jasync ping() {
    printf("ping.. %d\n", counter++);
    pong();
}

int main() {
    pong();
    return 0;
}
