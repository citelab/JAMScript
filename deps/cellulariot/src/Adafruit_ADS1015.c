/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
12-Nov-2018           Samuel G                Created the file
==================================================================*/

#include <stdio.h>
#include <stdlib.h>
#include <linux/i2c-dev.h>
#include <sys/ioctl.h>
#include <fcntl.h>
#include <unistd.h>

//Register and other configuration values:
#define ADS1015_ADDRESS                 0x49
#define ADS1015_POINTER_CONFIG          0x01
#define ADS1015_CONFIG_OS_SINGLE        0x8000

#define ADS1015_CONFIG_GAIN_2_OVER_3 0x0000
#define ADS1015_CONFIG_GAIN_1 0x0200
#define ADS1015_CONFIG_GAIN_2 0x0400
#define ADS1015_CONFIG_GAIN_4 0x0600
#define ADS1015_CONFIG_GAIN_8 0x0800
#define ADS1015_CONFIG_GAIN_16 0x0A00

#define ADS1015_CONFIG_MODE_CONTINUOUS 0x0000
#define ADS1015_CONFIG_MODE_SINGLE 0x0100

#define ADS1015_CONFIG_DR_128   0x0000
#define ADS1015_CONFIG_DR_250   0x0020
#define ADS1015_CONFIG_DR_490   0x0040
#define ADS1015_CONFIG_DR_920   0x0060
#define ADS1015_CONFIG_DR_1600  0x0080
#define ADS1015_CONFIG_DR_2400  0x00A0
#define ADS1015_CONFIG_DR_3300  0x00C0

#define ADS1015_CONFIG_COMP_QUE_DISABLE = 0x0003

int file = 0;

int _init () {
    
	int file;
	char *bus = "/dev/i2c-1";

	if((file = open(bus, O_RDWR)) < 0) 
        return -1;
	
	ioctl(file, I2C_SLAVE, ADS1015_ADDRESS);
}

int _read_adc(int *data, int channel, float gain) {

    if (file == 0)
        if (_init() != 0)
            return -1;

    if (channel < 0 | channel > 3)
        return -1;

    union {
        char ba[2];
        float f;
    } config_data;

    config_data.f = ADS1015_CONFIG_OS_SINGLE;
    config_data.f = config_data.f | ((channel & 0x000B) << ADS1015_CONFIG_MUX_OFFSET);

    if (gain == 2f/3f)
        config_data.f = config_data.f | ADS1015_CONFIG_GAIN_2_OVER_3;
    else if (gain == 1f)
        config_data.f = config_data.f | ADS1015_CONFIG_GAIN_1;
    else if (gain == 2f)
        config_data.f = config_data.f | ADS1015_CONFIG_GAIN_2;
    else if (gain == 4f)
        config_data.f = config_data.f | ADS1015_CONFIG_GAIN_4;
    else if (gain == 8f)
        config_data.f = config_data.f | ADS1015_CONFIG_GAIN_8;
    else if (gain == 16f)
        config_data.f = config_data.f | ADS1015_CONFIG_GAIN_16;
    else
        return -1;

    config_data.f = config_data.f | ADS1015_CONFIG_MODE_SINGLE;
    config_data.f = config_data.f | ADS1015_CONFIG_DR_1600;
    config_data.f = config_data.f | ADS1015_CONFIG_COMP_QUE_DISABLE;

    char config[] = char[3];
    config[0] = ADS1015_POINTER_CONFIG;
    config[1] = congif_data.ba[0];
    config[2] = congif_data.ba[1];

    struct timespec req_time, rem_time;
    req_time.tv_sec = 0;
    req_time.tv_nsec = 1;
    nanosleep(725000, &req_time, &rem_time);
    
    char reg[1] = {0x00};
	write(file, reg, 1);
	char buf[2] = {0};
	if(read(file, buf, 2) != 2)
        return -1;

    *data = 0 & (buf[0]>>4) & (buf[1]<<4);
    if (*data & 0x800 != 0)
        value = value - (1 << 12);

    return 0;
}