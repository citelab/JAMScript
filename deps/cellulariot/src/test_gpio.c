/********************************************************************
*@description: 	Test the user input button through GPIO.
*		Print GPIO data reading latency and the data recieved
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

#define GPIO_PIN 24 // User Button Input

int main() {
	clock_t start, end;
	if (gpioInitialise() < 0)
	{
		// Init failed
		printf("Init failed!\n");
	}
	else
	{
		for (int i = 1; i <= 10; i++)
		{
			start = clock();
			int gpio_val = gpioRead(GPIO_PIN);
			gpio_val = gpioRead(GPIO_PIN);
			end = clock();
			double cpu_time = ((double) (end - start)) / CLOCKS_PER_SEC;

			printf("[%d]\t Value read:\t %d\n", i, gpio_val);
			printf("\t CPU Time (ms):\t %f\n", cpu_time * 1000);		
		}

	}
}

