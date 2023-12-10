
#ifndef FILEHANDLING_H
#define FILEHANDLING_H

#include <dirent.h>
#include "VehicleInformation.h"
#include "DataPoint.h"

DIR* getDirectory(const char* path);
char* GetFileNameWithExtension(const char* fileName, const char *extension);
char* GetFileNameWithSequentialIdentifier(const char* fileName, const char* extension, int sequenceNumber);
int WriteBinaryFile(const char *filename, struct VehicleInformation *vehicleInformation, struct DataPoint *dataPoints, size_t numDataPoints);
int WriteCsvFile(const char *filename, struct VehicleInformation *vehicleInformation, struct DataPoint *dataPoints, size_t numDataPoints);
char* GetSequencedFileName(const char* extension, int sequenceNumber);
#endif