#include <stdio.h>

jactivity_t *firstcall(char*);

jasync testy(jcallback cb) {
	printf("testy called\n");
	cb("ah");
}


int main() {
	firstcall("Hello");
    return 0;
}
