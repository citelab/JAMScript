#include <unistd.h>

int main(int argc, char **argv) {
	for (int i = 1; i < 200000 ; i++) {
		x = i;
		printf("x logged.. %d\n", i);
		usleep(1000); }
}
