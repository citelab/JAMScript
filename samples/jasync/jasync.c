#include <stdio.h>

jactivity_t* pong();

jasync ping() {
	printf("ping\n");
	pong();
}

int main() {
  ping();
    return 0;
}
