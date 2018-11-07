/* @author:	    Matthew L-K matthew.lesko-krleza@mail.mcgill.ca
@description: 	Read temperature 

Modification Log
--------------------------------------------------------------------
Date		    Author		    Modification
07-Nov-2018	    Matthew L-K	    Created the file
==================================================================*/
#include <i2c-dev.h>
#include <i2c/smbus.h>
#include <sys/ioctl.h>
#include <fcntl.h>

#define I2C_BUS 1
#define HDC1080_I2C_ADDRESS 0x40
#define ACQUISITION_CONFIGURATION_REGISTER_ADDRESS 0x02
#define TEMPERATURE_MEASUREMENT_ADDRESS 0x00
#define HUMIDITY_MEASUREMENT_ADDRESS 0x01
#define I2C_FLAGS 0

/*
@description: Opens and returns a file descriptor for reading temperature data
@author: Matthew L-K
*/
int HDC1000_temp_open()
{
    int fd;
    char *bus = "dev/i2c-temp";
    if ((fd = open(bus, O_RDWR)) < 0)
    {
        printf("Failed to open the bus. \n");
        return -1;
    }

    ioctl(file, I2C_SLAVE, HDC1080_I2C_ADDRESS);

    char config[2] = {0};
    config[0] = ACQUISITION_CONFIGURATION_REGISTER_ADDRESS;
    // Set acquisition mode to independently measure temperature with 14 bit resolution
    config[1] = 0x00;

    write(fd, config, 2);
    return fd;
}

/*
@description: Opens and returns a file descriptor for reading humidity data
@author: Matthew L-K
*/
int HDC1000_humid_open();

/*
@description: Reads from file descriptor and stores temperature value to given buffer
@author: Matthew L-K
@return: int: 0 No Error, -1 Error
*/
int read_temperature(int fd, int *data)
{
    char reg[1] = {TEMPERATURE_MEASUREMENT_ADDRESS};
    write(fd, reg, 1);

    // Temperature register is a 16-bit result register (the 2 LSBs are always 0)
    char buff[2] = {0};
    if (read(fd, buff, 2) != 2)
    {
        printf("Error: Input/Output error. \n");
        return -1;
    }
    else
    {
        short temp = (buff[1] << 8) | buff[0];
        &data = (temp / 65536) * 165 - 40;
        return 0;
    }
    return -1;
}

int read_humidity(int *data)
{

}

int HDC1000_temp_close()
{

}

int HDC1000_humid_close()
{

}