#include <unistd.h>

int main() {
	for (int i = 1;; i++) {
		t = i;
		s = {.apple:i, .pear:i+0.1};
		usleep(3000);
	}
}
