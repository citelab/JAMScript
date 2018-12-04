/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
03-Dec-2018           Samuel G                Created the file
==================================================================*/

int read_acc(int *data);

int read_adc(int *data, int channel, float gain);

int read_lux(int *data);

int read_temp (int *data);

int read_hum (int *data);

int read_gps (int *data);
