#include <unistd.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>

int main(){//int argc, char **argv
    srand(time(NULL));

    char *label = "Slot 1";// argv[2]; //"Slot 1";
    int isFree = 1; //strtol(argv[3], NULL, 10);
    float longitude = 54.3; // strtof(argv[4], NULL); //54.3;
    float latitude = 101.2; // strtof(argv[5], NULL); //101.2;
    int accessibility = 0; // strtol(argv[6], NULL, 10); //0;
    int allowedParkingDuration = 60; //60 minutes

    spot = {.label:label, .longitude:longitude, .latitude:latitude, .isFree:isFree, .parkingDuration:allowedParkingDuration, .accessibility:accessibility};

    while( 1 ){
        sleep(rand() % 20);
        isFree = (isFree + 1) % 2;
        spot = {.label:label, .longitude:longitude, .latitude:latitude, .isFree:isFree, .parkingDuration:allowedParkingDuration, .accessibility:accessibility};
    }

    return 0;
}

//TODO
//this application should listen for changes to know when a car has parked on it.
//it should also time the cars to know if a car has exceeded its timing and call for ticketing.