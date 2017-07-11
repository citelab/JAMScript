#include <unistd.h>

int main(int argc, char **argv) {
	for (int i = 0;; i++) {
		t = i;
		s = {.apple:i, .pear:i+0.1};
		sleep(1);
	}
}
