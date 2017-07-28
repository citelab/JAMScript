#include <unistd.h>
#include <stdlib.h>

int main() {
	int low, diff;
	for (int i = 1;; i++) {
		low = rand()%15+15;
		diff = rand()%10;
		MTLWeather = {.lowTemperature: low, .highTemperature: low+diff};
		sleep(1);
	}
}