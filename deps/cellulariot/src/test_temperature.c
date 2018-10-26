/********************************************************************
*@description: 	Test the temperature and humidity sensor through I2C.
*		Print I2C data reading latency and the data recieved
*@author:	Matthew L-K matthew.lesko-krleza@mail.mcgill.ca
*Modification Log
*--------------------------------------------------------------------
*Date		Author		Modification
*24-Oct-2018	Matthew L-K	Created the file and wrote the test
*********************************************************************
*/
#include <stdio.h>
#include <pigpio.h>
#include <time.h>

#define I2C_BUS 1
#define TEMPERATURE_I2C_ADDR 0x40
#define I2C_FLAGS 0

int main() {
	clock_t start, end;
	if (gpioInitialise() < 0)
	{
		// Init failed
		printf("Init failed!\n");
	}
	else
	{
		printf("Measure time to read 1 byte from an I2C input\n");
		double average = 0;
		unsigned int i2c_handler = i2cOpen(I2C_BUS, TEMPERATURE_I2C_ADDR, I2C_FLAGS);

		for (int i = 1; i <= 10; i++)
		{
			start = clock();
			int temp_val = i2cReadByte(i2c_handler);
			end = clock();
			double cpu_time = ((double) (end - start)) / CLOCKS_PER_SEC;
			average += cpu_time * 1000 / 10;

			printf("[%d]\t Value read:\t %d\n", i, temp_val);
			printf("\t CPU Time (ms):\t %f\n", cpu_time * 1000);		
		}
		
		printf("Average time (ms): %f\n", average);
		gpioTerminate();
	}
}

