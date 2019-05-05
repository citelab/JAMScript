/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
03-Dec-2018           Samuel G                Created the file
25-Feb-2019           Matthew Lk              Clear data after each test
==================================================================*/

#include <stdio.h>
#include "../src/libhat.h"

int main() {

    int data[3];
	int sfd = -1;

    printf("Accelerometer:\n");
    sfd = sopen(ACC);    
    if (sread(sfd, data) == 0) 
	{
        printf("\tRead successful. Data received: %i, %i and %i\n\n", data[0], data[1], data[2]);
    }
    else
    {
        printf("\tRead failed\n\n");
    }
	sclose(sfd);
    data[0] = 0;
    data[1] = 0;
    data[2] = 0;

    printf("ADC:\n");
	sfd = sopen_adc(0, 1.0f);
    if (sread(sfd, data) == 0)
    {
        printf("\tRead successful. Data received: %i\n\n", data[0]);
    }
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data[0] = 0;

    printf("Ambient light:\n");
	sfd = sopen(LUX);
    if (sread(sfd, data) == 0) 
	{
        printf("\tRead successful. Data received: %i\n\n", data[0]);
	}
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data[0] = 0;

    printf("Temperature:\n");
	sfd = sopen(TEMP);
    if (sread(sfd, data) == 0)
	{
        printf("\tRead successful. Data received: %i\n\n", data[0]);
	}
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data[0] = 0;

    printf("Humidity:\n");
	sfd = sopen(HUM);
    if (sread(sfd, data) == 0)
	{
        printf("\tRead successful. Data received: %i\n\n", data[0]);
	}
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
}

