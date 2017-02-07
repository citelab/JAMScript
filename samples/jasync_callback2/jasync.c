#include <stdio.h>



jasync testy(jcallback cb) {
	printf("testy called\n");
	cb("ah");
}


int main() {
    return 0;
}
