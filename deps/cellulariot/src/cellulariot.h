/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
03-Dec-2018           Samuel G                Created the file
19-Mar-2019           Samuel G                Adapted for file abstraction layer
19-Mar-2019           Samuel G                Adapted for file abstraction layer
==================================================================*/

#define TEMP 1
#define HUM 2
#define ACC 3
#define LUX 4
#define ADC 5

int sopen(int sensorType);

int sread(int fd, int *data);

int sclose(int fd);

int sopen_adc(int channel, float gain);
