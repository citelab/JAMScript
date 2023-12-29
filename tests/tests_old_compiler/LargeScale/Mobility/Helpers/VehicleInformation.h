#ifndef VEHICLEINFORMATION_H
#define VEHICLEINFORMATION_H

struct VehicleInformation
{
    int vehicleNumber;
    int vehicleIdentifier;
    int numDataPoints;
};

struct VehicleInformation CreateVehicleInformation(int vehicleNumber, int vehicleIdentifier);

#endif