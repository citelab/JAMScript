/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
==================================================================*/

#include "SDL_Pi_HDC1000.h"
#include "MMA8452Q.h"
#include "Adafruit_ADS1x15.h"

#if !defined(NULL)
#define NULL 0
#endif

typedef struct {
    MMA8452Q *acc;
    ADS1015 *adc;
    HDC1000 *temph;
} CellularIoT;

int CellularIoT_init(CellularIoT *ciot) {
    
    //*ciot = Get memory
    ciot->acc = NULL;
    ciot->adc = NULL;
    ciot->temph = NULL; 

    return -1;
}

int readAccel(CellularIoT *ciot, int *data) {

    if (ciot->acc == NULL)
        if (MMA8452Q_init(ciot->acc) != 0)
            return -1;

    return readAcc(ciot->acc, data);
}

int readAdc (CellularIoT *ciot, int *data, int channelNumber) {

    if (ciot->adc == NULL)
        if (ADS1015_init(ciot->adc, 0x49, 1) != 0)
            return -1;

    if (channelNumber < 0 | channelNumber > 3)
        return -1;
    return read_adc(ciot->adc, data, channelNumber, 1);
}

int readTemp (CellularIoT *ciot, int *data) {

    if (ciot->temph == NULL) {
        if (HDC1000_init(ciot->temph) == 0) {
            setTemperatureResolution(HDC1000_CONFIG_TEMPERATURE_RESOLUTION_14BIT);
        }
        else
            return -1;
    }

	return  readTemperature(ciot->temph, data);
}

int readHum (CellularIoT *ciot, int *data) {

    if (ciot->temph == NULL) {
        if (HDC1000_init(ciot->temph) == 0) {
            setHumidityResolution(HDC1000_CONFIG_HUMIDITY_RESOLUTION_14BIT);
        }
        else
            return -1;
    }

	return  readHumidity(ciot->temph, data);
}