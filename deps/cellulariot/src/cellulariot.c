/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
12-Nov-2018           Samuel G                Updated to reflect new model
03-Dec-2018           Samuel G                Standardized interface
19-Mar-2019           Samuel G                Adapted for file abstraction layer
==================================================================*/

#include <stdio.h>

#include "SDL_Pi_HDC1000.h"
#include "MMA8452Q.h"
#include "Adafruit_ADS1015.h"
#include "cellulariot.h"

#if !defined(NULL)
#define NULL 0
#endif

#define LUX_CHANNEL 3
#define MAX_NUM_FILE 10

typedef sensor_file_entry struct sfe {
    int sensor_type;
    int fd;
};

sensor_files_entry sensor_files[MAX_NUM_FILE];

int open_lux() {
    ADS1015_init(LUX_CHANNEL, 1.0f);
}

int sopen(int sensorType) {

    int fd = -1;

    switch (sensorType & 224) {
        case TEMP:  fd = HDC1080_open()
                    break;
        case HUM:   fd = HDC1080_open()
                    break;
        case LUX:   fd = ADS1015_open(LUX_CHANNEL, 1)
                    break;
        case ACC:   fd = MMA8452Q_open()
                    break;
        case ADC:   int channel = sensorType & 24;
                    int gainCode = sensorType & 7;
                    float gain = gainCode>0 ? (float)2^(gainCode-1) : 2.0f/3.0f
                    fd = ADS1015_open(channel, gain);
                    break;
        default:    print("Invalid sensor type");
    }

    if (fd < 0) {
        return -1;
    }

    for (int index=0; index < MAX_NUM_FILE; index++) {
        if(sensor_files[index].sensorType != NULL) {
            sensor_files[index].sensorType = sensorType;
            sensor_files[index].fd = fd;
            return index;
        }
    }

    print("The maximum number of sensors file descriptors has already been reached");
    return -1;
}

int sread(int sfd, int *data) {
    if (sfd < 0 || fd >= MAX_NUM_FILE) {
        print("Invalid sensor file descriptor");
        return -1;
    }
    int sensorType = sensor_files[sfd].sensorType;
    int fd = sensor_files[sfd].fd;
    if (sensorType == NULL || fd < 0) {
        print("Invalid sensor file descriptor");
        sensor_files[sfd].sensorType = NULL;
        sensor_files[sfd].fd = -1;
        return -1;
    }
    switch (sensorType) {
        case TEMP:  return read_temp(fd, data);
        case HUM:   return read_hum(fd, data);
        case LUX:   return read_adc(fd, data);
        case ADC:   return read_adc(fd, data);
        case ACC:   return read_acc(fd, data);
        case GPS:   return read_gps(fd, data);
        default:    print("Invalid sensor type");
    }
    return -1;
}

int sclose(int fd) {
    if (sfd < 0 || fd >= MAX_NUM_FILE) {
        print("Invalid sensor file descriptor");
        return -1;
    }
    int sensorType = sensor_files[sfd].sensorType;
    int fd = sensor_files[sfd].fd;
    sensor_files[sfd].sensorType = NULL;
    sensor_files[sfd].fd = -1;
    if (sensorType == NULL || fd < 0) {
        print("Invalid sensor file descriptor");
        return -1;
    }

    //None of the individual sensor module drivers that we have written have dedicated close functions
    return close(fd);
}
