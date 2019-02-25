/* @author:	    Matthew L-K matthew.lesko-krleza@mail.mcgill.ca
@description: 	Configure temperature and humidity sensors and read respective measurements 
Modification Log
--------------------------------------------------------------------
Date		    Author		    Modification
07-Nov-2018	    Matthew L-K	    Created the file
03-Dec-2018     Samuel G        Standardized interface
==================================================================*/

#include <linux/i2c-dev.h>
#include <sys/ioctl.h>
#include <stdlib.h>
#include <stdio.h>
#include <fcntl.h>

#define I2C_BUS 1
#define HDC1080_I2C_ADDRESS 0x40
#define ACQUISITION_CONFIGURATION_REGISTER_ADDRESS 0x02
#define TEMPERATURE_MEASUREMENT_ADDRESS 0x00
#define HUMIDITY_MEASUREMENT_ADDRESS 0x01
#define I2C_FLAGS 0

/*
@description: 	Opens and returns a file descriptor for reading temperature and humidity data
@author: 	Matthew L-K
@return:	int: File descriptor for sensor
*/
int HDC1080_open()
{
    int fd;
    char *bus = "/dev/i2c-1";
    if ((fd = open(bus, O_RDWR)) < 0)
    {
        printf("Failure HDC1080: Failed to open the bus.\n");
        return -1;
    }

    ioctl(fd, I2C_SLAVE, HDC1080_I2C_ADDRESS);

    // Set acquisition mode to independently measure temperature and humidity
    // with 14 bit resolutions
    char config[3] = {0};
    config[0] = ACQUISITION_CONFIGURATION_REGISTER_ADDRESS;
    config[1] = 0x00;
    config[2] = 0x00;
    write(fd, config, 3);
    sleep(0.015); // Time from data sheet

    return fd;
}

/*
@description: 	Reads temperature and stores parsed value to given buffer
@author: 	Matthew L-K
@arguments: 	&data address for buffer
@return: 	int: 0 No Error, -1 Error
*/
int _read_temperature(int *data)
{
    int fd = HDC1080_open();
    char reg[1] = {TEMPERATURE_MEASUREMENT_ADDRESS};
    write(fd, reg, 1);
    sleep(0.0625); // Time from data sheet

    // Temperature register is a 16-bit result register (the 2 LSBs are always 0)
    char buff[2] = {0};
    if (read(fd, buff, 2) != 2)
    {   
        printf("Failure HDC1080: Input/Output error. \n");
        return -1;
    }

    short temp = (buff[1] << 8) | buff[0];
    *data = (temp / 65536) * 165 - 40;
    close(fd);

    return 0;
}

/*
@description: 	Reads humidity and stores parsed value to given buffer
@author: 	Matthew L-K
@arguments:	&data address for buffer
@return: 	int: 0 No Error, -1 Error
*/
int _read_humidity(int *data)
{
    int fd = HDC1080_open();
    char reg[1] = {HUMIDITY_MEASUREMENT_ADDRESS};
    write(fd, reg, 1);
    sleep(0.015); // Time from data sheet

    // Humidity register is a 16-bit result register (the 2 LSBs are always 0)
    char buff[2] = {0};
    if (read(fd, buff, 2) != 2)
    {
        printf("Failure HDC1080: Input/Output error. \n");
        return -1;
    }
    short humid = (buff[1] << 8) | buff[0];
    *data = (humid / 65536) * 100;
    close(fd);

    return 0;
}
