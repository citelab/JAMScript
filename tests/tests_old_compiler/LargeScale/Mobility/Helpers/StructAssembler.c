#define __USE_XOPEN
#define _GNU_SOURCE

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <sys/types.h>
#include "constants.h"
#include "FileHandling.h"
#include "DataPoint.h"
#include "VehicleInformation.h"

struct DataPoint *AssembleDataPointsAndVehicleInformationFromCsv(const char* filename, int vehicleNumber, struct VehicleInformation *vehicleInformation) {
    FILE *file = fopen(filename, "r");
    if (file == NULL) {
        perror("Failed to open file");
        return NULL;
    }

    char line[1024];
    size_t currentDataPointsCapacity = INITIAL_DATAPOINT_SIZE;
    size_t currentDataPointCount = 0;

    struct DataPoint *dataPoints = malloc(INITIAL_DATAPOINT_SIZE * sizeof(struct DataPoint));
    while (fgets(line, sizeof(line), file) != NULL) {
        struct DataPoint dataPoint;
        time_t time;
        float x;
        float y;

        char* token = strtok(line, ",");
        int columnNum = 0;

        while (token != NULL) {
            if (currentDataPointCount == 0 && columnNum == 0) {
                /*VehicleInformation*/
                int vehicleID = atoi(token);
                *vehicleInformation = CreateVehicleInformation(vehicleNumber, vehicleID);
            }
            else if (columnNum == 0) {
                int vehicleIdentifier = atoi(token);
                if (vehicleIdentifier != vehicleInformation->vehicleIdentifier) {
                    fprintf(stderr, "Data error: %s <file>\n", filename);
                    fclose(file);
                    vehicleInformation = NULL;
                    free(dataPoints);

                    return NULL;
                }
            }
            
            else if (columnNum == 1) {
                /*DateTime*/
                struct tm timeInfo;
                memset(&timeInfo, 0, sizeof(struct tm));
                if (strptime(token, DATE_TIME_FORMAT, &timeInfo) == NULL) {
                    fprintf(stderr, "Failed to parse time\n");
                    free(dataPoints);
                    fclose(file);

                    vehicleInformation = NULL;
                    return NULL;
                }
                else {
                    time = mktime(&timeInfo);
                }
            }

            else if (columnNum == 2) {
                /*X position*/
                x = strtof(token, NULL);
            }

            else if (columnNum == 3) {
                /*Y position*/
                y = strtof(token, NULL);
            }

            columnNum++;
            token = strtok(NULL, ",");
        }

        if (currentDataPointCount == currentDataPointsCapacity) {
            currentDataPointsCapacity = currentDataPointsCapacity * 2;
            dataPoints = realloc(dataPoints, currentDataPointsCapacity * sizeof(struct DataPoint));
        }

        dataPoint = CreateDataPoint(time, x, y);
        dataPoints[currentDataPointCount] = dataPoint;
        currentDataPointCount++;
    }

    vehicleInformation->numDataPoints = currentDataPointCount;

    fclose(file);
    return dataPoints;
}

struct DataPoint *AssembleDataPointsAndVehicleInformationFromBinary(const char* filename, struct VehicleInformation *vehicleInformation) {
    FILE *file = fopen(filename, "rb");
    if (file == NULL) {
        perror("Failed to open file");
        return NULL;
    }

    size_t readSize = fread(vehicleInformation, sizeof(struct VehicleInformation), 1, file);
    if (readSize != 1) {
        perror("Problem reading binary file.");
        fclose(file);
        return NULL;
    }

    int numDataPoints = vehicleInformation->numDataPoints;
    struct DataPoint *dataPoints = (struct DataPoint *)malloc(numDataPoints * sizeof(struct DataPoint));
    if (dataPoints == NULL) {
        perror("DataPoints memory allocation failed");
        fclose(file);
        return NULL;
    }

    fread(dataPoints, sizeof(struct DataPoint), numDataPoints, file);
    fclose(file);
    return dataPoints;
}
