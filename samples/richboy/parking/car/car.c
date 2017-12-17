#include <unistd.h>
#include <stdlib.h>

char* getCarID();

char* carID;

//this car has received a message to occupy this slot
jasync park(char* postcode, char* slot) {
	//do parking implementation
}

int main(int argc, char **argv){
    carID = getCarID();
    while (jam_error != 0) {
        usleep(2000);
        carID = getCarID();
    }
    printf("Assigned Car ID is: %s\n", carID);

    return 0;
}