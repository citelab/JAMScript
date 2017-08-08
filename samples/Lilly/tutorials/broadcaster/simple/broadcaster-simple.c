#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
	while (1) {
		sleep(1);
		printf("Current time\n%s\n", curTime);
	}
}