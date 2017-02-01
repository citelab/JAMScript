#include <stdio.h>

jactivity_t* pong();

jasync ping() {
	printf("ping\n");
	pong();
}

int main() {
    return 0;
}
