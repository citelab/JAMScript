#include "VehicleInformation.h"

struct VehicleInformation CreateVehicleInformation(int vehicleNumber, int vehicleIdentifier) {
    struct VehicleInformation vi;
    vi.vehicleNumber = vehicleNumber;
    vi.vehicleIdentifier = vehicleIdentifier;
    return vi;
}