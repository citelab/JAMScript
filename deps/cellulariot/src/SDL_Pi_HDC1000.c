/* @author:	    Matthew L-K matthew.lesko-krleza@mail.mcgill.ca
@description: 	Configure temperature and humidity sensors and read respective measurements 
Modification Log
--------------------------------------------------------------------
Date		    Author		    Modification
07-Nov-2018	    Matthew L-K	    Created the file
03-Dec-2018     Samuel G        Standardized interface
19-Mar-2019           Samuel G                Adapted for file abstraction layer
==================================================================*/

#include <linux/i2c-dev.h>
#include <sys/ioctl.h>
#include <stdlib.h>
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>

#define I2C_BUS 1
#define I2C_FLAGS 0

#define HDC1080_I2C_ADDRESS 						(char) 0x40
#define HDC1080_CONFIGURATION_REGISTER 				(char) 0x02
#define HDC1080_TEMPERATURE_REGISTER 				(char) 0x00
#define HDC1080_HUMIDITY_REGISTER 					(char) 0x01

#define HDC1080_CONFIG_ACQUISITION_MODE 			(char) 0x10
#define HDC1080_CONFIG_TEMPERATURE_RESOLUTION_14BIT (short) 0x0000
/*
@description: 	Opens and returns a file descriptor for reading temperature and humidity data
@author: 	Matthew L-K
@return:	int: 0 No Error, -1 Error
*/
int HDC1080_open()
{
    char *bus = "/dev/i2c-1";
    int fd = open(bus, O_RDWR);
    if (fd < 0) 
    {
        printf("Failure HDC1080: Failed to open the bus.\n");
        return -1;
    }
    ioctl(fd, I2C_SLAVE, HDC1080_I2C_ADDRESS);

    // Set acquisition mode to independently measure temperature and humidity
    // with 14 bit resolutions
    char config[3] = {0};
    config[0] = HDC1080_CONFIGURATION_REGISTER;
    config[1] = HDC1080_CONFIG_ACQUISITION_MODE;
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
int read_temperature(int fd, int *data)
{
	char config[2] = {0};
	config[0] = HDC1080_CONFIGURATION_REGISTER;
	config[1] = HDC1080_TEMPERATURE_REGISTER;
	write(fd, config, 2);
	sleep(0.625);
	
    // Temperature register is a 16-bit result register (the 2 LSBs are always 0)
    char buff[2] = {0};
    if (read(fd, buff, 2) != 2)
    {   
        printf("Failure HDC1080: Input/Output error. \n");
        return -1;
    }
	
	short temp = buff[0] * 256 + buff[1];
    *data = (temp / 65536) * 165 + 25;
    close(fd);

    return 0;
}

/*
@description: 	Reads humidity and stores parsed value to given buffer
@author: 	Matthew L-K
@arguments:	&data address for buffer
@return: 	int: 0 No Error, -1 Error
*/
int read_humidity(int fd, int *data)
{
    char reg[2] = {0};
    reg[0] = HDC1080_I2C_ADDRESS + 1; // Last bit must be set high for a read
    reg[1] = HDC1080_HUMIDITY_REGISTER;
    write(fd, reg, 2);
    sleep(0.0625);

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

int read_configuration_register(int fd, short *data)
{
	char config[1] = {HDC1080_CONFIGURATION_REGISTER};
	write(fd, config, 1);
	sleep(0.0625);

	char buff[2] = {0};
	if ((read(fd, buff, 2)) != 2)
	{
		printf("Failure HDC1080: Read Config Register Error. \n");
		return -1;
	}
	
	*data = buff[0] * 256 + buff[1];

	return 0;
}

