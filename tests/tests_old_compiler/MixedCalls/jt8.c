
void driveNode(double lg, double lt, int soc);

enum ChargerType {
    CHAdeMO,
    CCS,
    TeslaSuperCharger
};

struct Vehicle {
    char model[50];
    char make[50];
    enum ChargerType chargerTypeCompatibility;
    float range; 
}; 

struct VehicleInformation
{
    int vehicleNumber;
    int vehicleIdentifier;
    int numDataPoints;
    struct Vehicle vehicle;
};

struct DataPoint {
    time_t time;
    double longitude;
    double latitude;
    double distanceFromStart;
    int stateOfCharge;
};

struct VehicleInformation vehicleInformation;
struct DataPoint *dataPoints;

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

jtask* processDataPoints() {
    int pointIndex = 0;
    bool tracingBack = false;

    while(1) {
        jsleep(100000);
        printf("############-->>> %d Vehicle: %d Moved to {%f, %f}\n", pointIndex, vehicleInformation.vehicleNumber, dataPoints[pointIndex].longitude, dataPoints[pointIndex].latitude);
        driveNode(dataPoints[pointIndex].longitude, dataPoints[pointIndex].latitude, dataPoints[pointIndex].stateOfCharge);
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

jtask* setupWorker(int id) {
    char filePath[32];

    snprintf(filePath, 32, "tdata/%d.bin", id);
    dataPoints = AssembleDataPointsAndVehicleInformationFromBinary(filePath, &vehicleInformation);
    processDataPoints();
}


int main(int argc, char *argv[]) {

    return 0;
}
