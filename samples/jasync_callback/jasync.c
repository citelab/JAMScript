#include <stdio.h>

jactivity_t *print_msg(char*, jcallback);

void cbf(char* abc) {
	printf("Message received\n");
}

int main() {
	print_msg("test", cbf);
    return 0;
}
