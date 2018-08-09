/*Sample Demo Program*/
#include <unistd.h>
#include <stdlib.h>


jsync int getDroneSpeed() {
	return rand() % 100;
}

int main() {
	printf("Drone online!\n");
}