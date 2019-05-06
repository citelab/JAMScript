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
#include "libhat.h"

#ifndef NULL
#define NULL 0
#endif

#define LUX_CHANNEL 3
#define MAX_NUM_FILE 10

typedef struct sfe {
    int sensor_type;
    int fd;
} sensor_files_entry;

sensor_files_entry sensor_files[MAX_NUM_FILE];

int open_lux() {
    ADS1015_open(LUX_CHANNEL, 1.0f);
}

/*
    Available channels are 0, 1, 2, or 3 (Topmost to bottommost are 0, 1, 2, 3)
    Available gain values are 1, 2/3, 2, 4, 8, or 16
*/
int sopen_adc(int channel, float gain)
{
	int fd = -1;
	fd = ADS1015_open(channel, gain);
	
	if (fd < 0) 
	{
		return -1;
	}	

	for (int index=0; index < MAX_NUM_FILE; index++) {
        if(sensor_files[index].sensor_type == NULL) {
            sensor_files[index].sensor_type = ADC;
            sensor_files[index].fd = fd;
            return index;
        }
    }

    printf("The maximum number of sensors file descriptors has already been reached");
    return -1;
}

int sopen(int sensorType) {

    int fd = -1;

	if (sensorType == TEMP) 
	{
		fd = HDC1080_open();
	}
	else if (sensorType == HUM)
	{
		fd = HDC1080_open();
	}
	else if (sensorType == LUX)
	{
		fd = ADS1015_open(LUX_CHANNEL, 1);
	}
	else if (sensorType == ACC)
	{
		fd = MMA8452Q_open();
	}
	else if (sensorType == ADC)
	{
		printf("Invalid! Use sopen_adc to open the ADC");
	}
	else 
	{
		printf("Invalid sensor type");
	}

    if (fd < 0) {
        return -1;
    }

    for (int index=0; index < MAX_NUM_FILE; index++) {
        if(sensor_files[index].sensor_type == NULL) {
            sensor_files[index].sensor_type = sensorType;
            sensor_files[index].fd = fd;
            return index;
        }
    }

    printf("The maximum number of sensors file descriptors has already been reached");
    return -1;
}

int sread(int sfd, int *data) {
    if (sfd < 0 || sfd >= MAX_NUM_FILE) {
        printf("Invalid sensor file descriptor");
        return -1;
    }
    int sensorType = sensor_files[sfd].sensor_type;
    int fd = sensor_files[sfd].fd;
    if (sensorType == NULL || fd < 0) {
        printf("Invalid sensor file descriptor");
        sensor_files[sfd].sensor_type = NULL;
        sensor_files[sfd].fd = -1;
        return -1;
    }
    switch (sensorType) {
        case TEMP:  return read_temperature(fd, data);
        case HUM:   return read_humidity(fd, data);
        case LUX:   return read_adc(fd, data);
        case ADC:   return read_adc(fd, data);
        case ACC:   return read_acc(fd, data);
	//case GPS:   return read_gps(fd, data); // Should we keep GPS?
        default:    printf("Invalid sensor type");
    }
    return 0;
}

int sclose(int sfd) {
    if (sfd < 0 || sfd >= MAX_NUM_FILE) {
        printf("Invalid sensor file descriptor");
        return -1;
    }
    int sensorType = sensor_files[sfd].sensor_type;
    int fd = sensor_files[sfd].fd;
    sensor_files[sfd].sensor_type = NULL;
    sensor_files[sfd].fd = -1;
    if (sensorType == NULL || fd < 0) {
        printf("Invalid sensor file descriptor");
        return -1;
    }

    //None of the individual sensor module drivers that we have written have dedicated close functions
    return close(fd);
}
