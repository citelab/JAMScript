#include <unistd.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>


char *label;
int isFree = 1;
int hgrid;
int vgrid;
const int PARKING_DURATION = 60;//60 minutes

int main(int argc, char **argv){
    srand(time(NULL));

    label = argv[1]; //"Slot 1";
    hgrid = strtof(argv[2], NULL); //2;
    vgrid = strtof(argv[3], NULL); //3;

    log();

    while( 1 ){//keep alive
        sleep(1);
    }

    return 0;
}

jasync changeState(int state) {
	//inform the manager that the status has changed
	isFree = state;
	log();
}

void log(){
    spots = {.label:label, .hgrid:hgrid, .vgrid:vgrid, .isFree:isFree, .parkingDuration:PARKING_DURATION};
}


//TODO
//this application should listen for changes to know when a car has parked on it.
//it should also time the cars to know if a car has exceeded its timing and call for ticketing.