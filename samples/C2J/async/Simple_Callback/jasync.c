#include <stdio.h>

jactivity_t *print_msg(char*, jcallback);

void cbf(char* abc) {
	printf("I should be in C... Message received\n");
}

int main() {
print_msg("I should print in J node.......", cbf);
    return 0;
}
