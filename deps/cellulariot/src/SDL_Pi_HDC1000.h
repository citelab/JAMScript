/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
07-Nov-2018           Matthew L-K             Switch to file descriptor design
03-Dec-2018           Samuel G                Standardized interface
==================================================================*/

#define HDC1000_CONFIG_TEMPERATURE_RESOLUTION_14BIT 0x0000
#define HDC1000_CONFIG_HUMIDITY_RESOLUTION_14BIT 0x0000

int _read_temperature(int *data);

int _read_humidity(int *data);