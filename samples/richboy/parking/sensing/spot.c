#include <unistd.h>
#include <time.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>

int isFogRunning();
int getAssignedID();
char* getLabel(int);
char* getPostcode(int);
char* getAddress(int);
char* getStreamKey(int);

char* label;
char* status = "free";
char* postcode;
char* address;
char* key; //would be obtained using C->J
int assignedID;

const int PARKING_DURATION = 60;//60 minutes

void doLog(){
    spot = {.label:label, .postcode:postcode, .address:address, .status:status,
    .parkingDuration:PARKING_DURATION, .key:key, .assignedID:assignedID};
}

int main(){//int argc, char **argv
    printf("C is running...\n");
    srand(time(NULL));


//    label = argv[1]; //"Slot 1";
//    //hgrid = strtof(argv[2], NULL); //2;
//    postcode = argv[2];
//    address = argv[3];

    //The logger has some concerns which may need attending to later
    //we need the data to go up to the fog so the data can be shared so we poll till the fog comes online
//    int isFogOnline = isFogRunning();
//    while (jam_error != 0) {
//        usleep(2000);
//        isFogOnline = isFogRunning();
//    }

    //TODO before logging, use C->J to get the location details for this parking area, add it to the logged information
    assignedID = getAssignedID();
    while (jam_error != 0) {
        usleep(2000);
        assignedID = getAssignedID();
    }
    printf("Assigned ID is: %d\n", assignedID);

    label = getLabel(assignedID);
    postcode = getPostcode(assignedID);
    address = getAddress(assignedID);

    //temporarily set the key to null. will be ignored on the upper levels
    key = "null";

    doLog();  //log first so that the jside can see the log and get the stream key

    //now request for the stream key
    key = getStreamKey(assignedID);
    while (jam_error != 0 || strncmp(key, "null", 4) == 0 ) {
        usleep(2000);
        key = getStreamKey(assignedID);
    }
    printf("Assigned ID is: %d, Stream Key is: %s\n", assignedID, key);

    doLog();  //now do a proper log with the key
    doLog();
    doLog();

    return 0;
}


jasync changeState(char* state, int spotID, char* k) {
    if( assignedID != spotID || key != k )
        return;

	status = state;
	doLog();
}