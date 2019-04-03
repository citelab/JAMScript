/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
03-Dec-2018           Samuel G                Created the file
25-Feb-2019           Matthew Lk              Clear data after each test
==================================================================*/

#include <stdio.h>
#include "../src/cellulariot.h"

int main() {

    int data;
	int sfd = -1;

    printf("Accelerometer:\n");
    sfd = sopen(ACC);    
    if (sread(sfd, &data) == 0) 
	{
        printf("\tRead successful. Data received: %i\n\n", data);
    }
    else
    {
        printf("\tRead failed\n\n");
    }
	sclose(sfd);
    data = 0;

    printf("ADC:\n");
	sfd = sopen(ADC);
    if (sread(sfd, &data) == 0)
    {
        printf("\tRead successful. Data received: %i\n\n", data);
    }
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data = 0;

    printf("Ambient light:\n");
	sfd = sopen(LUX);
    if (sread(sfd, &data) == 0) 
	{
        printf("\tRead successful. Data received: %i\n\n", data);
	}
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data = 0;

    printf("Temperature:\n");
	sfd = sopen(TEMP);
    if (sread(sfd, &data) == 0)
	{
        printf("\tRead successful. Data received: %i\n\n", data);
	}
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data = 0;

    printf("Humidity:\n");
	sfd = sopen(HUM);
    if (sread(sfd, &data) == 0)
	{
        printf("\tRead successful. Data received: %i\n\n", data);
	}
    else
	{
        printf("\tRead failed\n\n");
	}
	sclose(sfd);
    data = 0;
}

