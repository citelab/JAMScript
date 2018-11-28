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
#define ADS1015_POINTER_CONVERSION      0x00
#define ADS1015_CONFIG_OS_CONTINUOUS    0x00

#define ADS1015_CONFIG_CHANNEL_0        0x40
#define ADS1015_CONFIG_CHANNEL_1        0x50
#define ADS1015_CONFIG_CHANNEL_2        0x60
#define ADS1015_CONFIG_CHANNEL_3        0x70

#define ADS1015_CONFIG_GAIN_2_OVER_3    0x00
#define ADS1015_CONFIG_GAIN_1           0x02
#define ADS1015_CONFIG_GAIN_2           0x04
#define ADS1015_CONFIG_GAIN_4           0x06
#define ADS1015_CONFIG_GAIN_8           0x08
#define ADS1015_CONFIG_GAIN_16          0x0A

#define ADS1015_CONFIG_MODE_CONTINUOUS 0x00

#define ADS1015_CONFIG_DR_1600  0x80

#define ADS1015_CONFIG_COMP_PARAM = 0x03

int file = 0;

int _init () {
    
	int file;
	char *bus = "/dev/i2c-1";

	if((file = open(bus, O_RDWR)) < 0) {
        printf("Adafruit_ADS1015: Failed to open bus");
        return -1;
    }
	
	ioctl(file, I2C_SLAVE, ADS1015_ADDRESS);

    char config[] = char[3];

    config[0] = ADS1015_POINTER_CONFIG;
    config[1] = ADS1015_CONFIG_OS_CONTINUOUS;

    switch(channel) {
        
        case 0:     config[1] = config[1] | ADS1015_CONFIG_CHANNEL_0;
                    break;
        case 1:     config[1] = config[1] | ADS1015_CONFIG_CHANNEL_1;
                    break;
        case 2:     config[1] = config[1] | ADS1015_CONFIG_CHANNEL_2;
                    break;
        case 3:     config[1] = config[1] | ADS1015_CONFIG_CHANNEL_3;
                    break;
        default:    printf("Adafruit_ADS1015: Invalid channel number");
                    return -1;
    }

    if (gain == 2f/3f)
        config[1] = config[1] | ADS1015_CONFIG_GAIN_2_OVER_3;
    else if (gain == 1f)
        config[1] = config[1] | ADS1015_CONFIG_GAIN_1;
    else if (gain == 2f)
        config[1] = config[1] | ADS1015_CONFIG_GAIN_2;
    else if (gain == 4f)
        config[1] = config[1] | ADS1015_CONFIG_GAIN_4;
    else if (gain == 8f)
        config[1] = config[1] | ADS1015_CONFIG_GAIN_8;
    else if (gain == 16f)
        config[1] = config[1] | ADS1015_CONFIG_GAIN_16;
    else {
        printf("Adafruit_ADS1015: Invalid gain");
        return -1;
    }

    config[2] = ADS1015_CONFIG_MODE_CONTINUOUS |
                ADS1015_CONFIG_COMPARATOR_PARAM |
                ADS1015_CONFIG_DR_1600;
    
	write(file, config, 3);
}

int _read_adc(int *data, int channel, float gain) {

    if (file == 0)
        if (_init() != 0)
            return -1;

	char buf[2] = {0};
	if(read(file, buf, 2) != 2) {
        printf("Adafruit_ADS1015: Failed to read data");
        return -1;
    }

    *data = int(buf[0])<<4 | int(buf[1]>>4);
    if (*data & 0x800 != 0)
        *data = (*data || 0x7FF);

    return 0;
}