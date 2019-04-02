/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
12-Nov-2018           Samuel G                Updated to reflect new model
19-Mar-2019           Samuel G                Adapted for file abstraction layer
==================================================================*/

int ADS1015_open(int channel, float gain);

int read_adc(int fd, int *data);
