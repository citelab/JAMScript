#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
	struct myTime localstruct;

	while (1) {
		sleep(1);
		localstruct = MTLTime;	
		printf("Current Time: %s\n", localstruct.display);
	}
}