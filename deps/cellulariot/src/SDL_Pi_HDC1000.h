/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
==================================================================*/

#define HDC1000_CONFIG_TEMPERATURE_RESOLUTION_14BIT 0x0000
#define HDC1000_CONFIG_HUMIDITY_RESOLUTION_14BIT 0x0000

typedef struct {
    //TODO
} HDC1000;

int HDC1000_init(HDC1000 *handle);

void setTemperatureResolution(int resolution);

void setHumidityResolution(int resolution);

int readTemperature(HDC1000 *handle, int *data);

int readHumidity(HDC1000 *handle, int *data);