#include <stdio.h>

jactivity_t *print_msg(char*, jcallback);

void cb() {
	printf("Message received\n");
}

int main() {
	print_msg("test", cb);
    return 0;
}
