/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
03-Dec-2018           Samuel G                Created the file
==================================================================*/

#include <stdio.h>
#include "../src/cellulariot.h"

int main() {

    int *data;

    printf("Accelerometer:\n");
    if (read_acc(data) == 0)
        printf("\tRead successful. Data received: %i\n\n", *data);
    else
        printf("\tRead failed\n\n");

    printf("ADC:\n");
    if (read_adc(data, 0) == 0)
        printf("\tRead successful. Data received: %i\n\n", *data);
    else
        printf("\tRead failed\n\n");

    printf("Ambient light:\n");
    if (read_lux(data) == 0)
        printf("\tRead successful. Data received: %i\n\n", *data);
    else
        printf("\tRead failed\n\n");

    printf("Temperature:\n");
    if (read_temp(data) == 0)
        printf("\tRead successful. Data received: %i\n\n", *data);
    else
        printf("\tRead failed\n\n");

    printf("Humidity:\n");
    if (read_hum(data) == 0)
        printf("\tRead successful. Data received: %i\n\n", *data);
    else
        printf("\tRead failed\n\n");

    printf("GPS:\n");
    if (read_gps(data) == 0)
        printf("\tRead successful. Data received: %i\n\n", *data);
    else
        printf("\tRead failed\n\n");
}
