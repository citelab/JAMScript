#include <stdio.h>

int counter = 0;

jactivity_t* pong();

jasync ping() {
    if (counter < 3)
        pong();
    printf("========ping.. %d\n", counter++);
}

int main() {
    pong();
    return 0;
}
