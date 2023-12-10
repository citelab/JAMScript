#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <sys/types.h>
#include "Helpers/DataPoint.h"
#include "Helpers/VehicleInformation.h"
#include "Helpers/StructAssembler.h"

void updateLocation(int vehicleId, float latitude, float longitude);

jtask* localReadPoints(struct DataPoint *dataPoints, struct VehicleInformation vehicleInformation) {
    int pointIndex = 0;
    bool tracingBack = false;

    while(1) {
        jsleep(10000);
        printf("############-->>> Vehicle: %d Moved to {%ld, %ld}\n", vehicleInformation.vehicleNumber, dataPoints[pointIndex].x, dataPoints[pointIndex].y);
        updateLocation(vehicleInformation.vehicleIdentifier, dataPoints[pointIndex].x, dataPoints[pointIndex].y);
        if (!tracingBack) {
            if (pointIndex == vehicleInformation.numDataPoints - 1) 
                tracingBack = true;
            else
                pointIndex++;
        }
        else {
            if (pointIndex == 0) {
                tracingBack = false;
            }
            else
                pointIndex--;
        }
    }
}

int main(int argc, char *argv[]) {
    char* filePath = "PATH_TO_BIN"; /* TODO: GET correct bin file number from cloud*/
    struct VehicleInformation vehicleInformation;
    struct DataPoint *dataPoints = AssembleDataPointsAndVehicleInformationFromBinary(filePath, &vehicleInformation);
    localReadPoints(dataPoints, vehicleInformation);
    return 0;
}