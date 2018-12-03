/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
12-Nov-2018           Samuel G                Updated to reflect new model
03-Dec-2018           Samuel G                Standardized interface
==================================================================*/

#include "SDL_Pi_HDC1000.h"
#include "MMA8452Q.h"
#include "Adafruit_ADS1x15.h"

#if !defined(NULL)
#define NULL 0
#endif

#define LUX_CHANNEL 3



int read_acc(int *data) {

    return _read_acc(data);
}

int read_adc(int *data, int channel) {

    return _read_adc(data, channel, 1f);
}

int read_lux(int *data) {

    int succ = _read_adc(data, LUX_CHANNEL);

    if (succ == 0)
        *data = (*data * 100) / 1580;

    return succ;
}

int read_temp (int *data) {

	return  _read_temperature(data);
}

int read_hum (int *data) {

	return  _read_humidity(data);
}

int read_gps (int *data) {

    return _read_gps(data);
}