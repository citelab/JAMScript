#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include <sys/types.h>
#include "FileHandling.h"
#include "constants.h"
#include "VehicleInformation.h"
#include "DataPoint.h"

DIR* getDirectory(const char* path) {
    fprintf(stdout, "Data set directory: %s\n", path);
    DIR *dir = opendir(path);
    
    if (dir == NULL) {
        fprintf(stderr, "Error opening datasets directory.");
        return NULL;
    }

    return dir;
}

char* GetSequencedFileName(const char* extension, int sequenceNumber) {
    char* result = NULL;
    int numberDigits = snprintf(NULL, 0, "%d", sequenceNumber);
    result = (char*)malloc(numberDigits + strlen(extension) + 1);
    if (result != NULL) {
        result[0] = '\0';
        char sequenceNumberStr[numberDigits];
        sprintf(sequenceNumberStr, "%d", sequenceNumber);
        strcat(result, sequenceNumberStr);
        strcat(result, extension);
    }
    return result;
}

char* GetFileNameWithSequentialIdentifier(const char* fileName, const char* extension, int sequenceNumber) {
    char* result = NULL;
    char* dotPosition = strrchr(fileName, '.');
    
    if (dotPosition != NULL) {
        size_t nakedFileNameLength = dotPosition - fileName;
        int numberDigits = snprintf(NULL, 0, "%d", sequenceNumber);
        result = (char*)malloc(nakedFileNameLength + strlen(SEQUENCE_KEY_IDENTIFIER) + numberDigits + strlen(extension) + 1);

        if (result != NULL) {
            strncpy(result, fileName, nakedFileNameLength);
            result[nakedFileNameLength] = '\0';
            strcat(result, SEQUENCE_KEY_IDENTIFIER);
            char sequenceNumberStr[numberDigits];
            sprintf(sequenceNumberStr, "%d", sequenceNumber); 
            strcat(result, sequenceNumberStr);
            strcat(result, extension);
        }
    }
    return result;
}

char* GetFileNameWithExtension(const char* fileName, const char *extension) {
    char* result = NULL;
    char* dotPosition = strrchr(fileName, '.');
    if (dotPosition != NULL) {
        size_t nakedFileNameLength = dotPosition - fileName;
        result = (char*)malloc(nakedFileNameLength + strlen(extension) + 1);

        if (result != NULL) {
            strncpy(result, fileName, nakedFileNameLength);
            result[nakedFileNameLength] = '\0';
            strcat(result, extension);
        }
    }
    return result;
}

int WriteBinaryFile(const char *filename, struct VehicleInformation *vehicleInformation, struct DataPoint *dataPoints, size_t numDataPoints) {
    mkdir(TARGET_BIN_DIRECTORY, 0777);
    char filePath[256]; // Adjust the size as needed
    snprintf(filePath, sizeof(filePath), "%s/%s", TARGET_BIN_DIRECTORY, filename);
    FILE *file = fopen(filePath, "wb");
    if (file == NULL) {
        perror("Failed to open file for writing");
        fclose(file);
        return -1;
    }
    fprintf(stdout, "About to write to file %s:\n\tVehicle information: {Vehicle number: %d}\n\tNumber of data point entries: %ld\n", filePath, vehicleInformation->vehicleNumber, numDataPoints);
    fwrite(vehicleInformation, sizeof(struct VehicleInformation), 1, file);
    fwrite(dataPoints, sizeof(struct DataPoint), numDataPoints, file);

    fclose(file);
    return 0;
}

int WriteCsvFile(const char *filename, struct VehicleInformation *vehicleInformation, struct DataPoint *dataPoints, size_t numDataPoints) {
    mkdir(TARGET_CSV_DIRECTORY, 0777);
    char filePath[256];
    snprintf(filePath, sizeof(filePath), "%s/%s", TARGET_CSV_DIRECTORY, filename);

    FILE *file = fopen(filePath, "w");
    if (file == NULL) {
        perror("Failed to open file for writing");
        fclose(file);
        return -1;
    }

    fprintf(stdout, "About to write to file %s:\n\tVehicle information: {Vehicle number: %d}\n\tNumber of data point entries: %ld\n", filePath, vehicleInformation->vehicleNumber, numDataPoints);
    for (int i = 0; i < numDataPoints; i++) {
        struct tm *timeInfo = localtime(&dataPoints[i].time);
        char formattedDateTime[20]; 
        strftime(formattedDateTime, sizeof(formattedDateTime), DATE_TIME_FORMAT, timeInfo);
        fprintf(file, "%d,%d,%s,%f,%f\n", vehicleInformation->vehicleNumber, vehicleInformation->vehicleIdentifier, formattedDateTime, dataPoints[i].x, dataPoints[i].y);
    }
    fclose(file);
    return 0;
}