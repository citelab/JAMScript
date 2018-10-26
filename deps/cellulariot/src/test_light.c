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
		unsigned int i2c_handler = i2cOpen(I2C_BUS, TEMPERATURE_I2C_ADDR, I2C_FLAGS);
		for (int i = 1; i <= 10; i++)
		{
			start = clock();
			int temp_val = i2cReadByte(i2c_handler);
			end = clock();
			double cpu_time = ((double) (end - start)) / CLOCKS_PER_SEC;

			printf("[%d]\t Value read:\t %d\n", i, temp_val);
			printf("\t CPU Time (ms):\t %f\n", cpu_time * 1000);		
		}

	}
}

