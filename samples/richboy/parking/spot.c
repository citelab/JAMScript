#include <unistd.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>

int main(int argc, char **argv){
    srand(time(NULL));

    char *label = argv[2]; //"Slot 1";
    int isFree = strtol(argv[3], NULL, 10);
    float longitude = strtof(argv[4], NULL); //54.3;
    float latitude = strtof(argv[5], NULL); //101.2;
    int accessibility = strtol(argv[6], NULL, 10); //0;
    int allowedParkingDuration = 60; //60 minutes

    spot = {.label:label, .longitude:longitude, .latitude:latitude, .isFree:isFree, .parkingDuration:allowedParkingDuration, .accessibility:accessibility};

    while( 1 ){
        sleep(rand() % 20);
        isFree = (isFree + 1) % 2;
        spot = {.label:label, .longitude:longitude, .latitude:latitude, .isFree:isFree, .parkingDuration:allowedParkingDuration, .accessibility:accessibility};
    }

    return 0;
}