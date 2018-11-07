/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
==================================================================*/

typedef struct {
    //TODO
} ADS1015;

int ADS1015_init(ADS1015 *handle, int address, int bus);

int read_adc(ADS1015 *handle, int *data, int channelNumber, int gain);