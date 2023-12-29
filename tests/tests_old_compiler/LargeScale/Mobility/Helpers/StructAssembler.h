#ifndef STRUCTASSEMBLER_H
#define STRUCTASSEMBLER_H

#include "VehicleInformation.h"
#include "DataPoint.h"

struct DataPoint *AssembleDataPointsAndVehicleInformationFromCsv(const char* filename, int vehicleNumber, struct VehicleInformation *vehicleInformation);
struct DataPoint *AssembleDataPointsAndVehicleInformationFromBinary(const char* filename, struct VehicleInformation *vehicleInformation) ;
#endif