#include <unistd.h>
#include <stdlib.h>

int main() {
//	int sensorStatus;
	for (int i = 1;; i++) {
		sensorStatus = rand()%2; 
		sleep(1);
	}
}
