#include <unistd.h>

int main() {
	for (int i = 0;; i++) {
		s = {.y: i, .f: 5.0};
		sleep(1);
	}
}
