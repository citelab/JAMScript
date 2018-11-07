#include <stdio.h>
#include <stdlib.h>
#include <linux/i2c-dev.h>
#include <sys/ioctl.h>
#include <fcntl.h>

int MMA8452Q_open(){
    int file;
    // Create I2C bus
	char *bus = "/dev/i2c-1";
	if((file = open(bus, O_RDWR)) < 0) 
	{
		printf("Failed to open the bus. \n");
		exit(1);
	}
	// Get I2C device, MMA8452Q I2C address is 0x1C(28)
	ioctl(file, I2C_SLAVE, 0x1C);
	
	// Select mode register(0x2A)
	// Standby mode(0x00)
	char config[2] = {0};
	config[0] = 0x2A;
	config[1] = 0x00;
	write(file, config, 2);

	// Select mode register(0x2A)
	// Active mode(0x01)
	config[0] = 0x2A;
	config[1] = 0x01;
	write(file, config, 2);
	
	// Select configuration register(0x0E)
	// Set range to +/- 2g(0x00)
	config[0] = 0x0E;
	config[1] = 0x00;
	write(file, config, 2);
	sleep(0.5);
    return file;
}
// TODO : format the output into char int[3] with x y z axis acceleration
int MMA8452Q_read(int *result,int file){
    // Read 7 bytes of data(0x00)
	// staus, xAccl msb, xAccl lsb, yAccl msb, yAccl lsb, zAccl msb, zAccl lsb
	char reg[1] = {0x00};
	write(file, reg, 1);
	char data[7] = {0};
	if(read(file, data, 7) != 7)
	{
		printf("Error : Input/Output error \n");
	}
	else
	{
		// Convert the data to 12-bits
		int xAccl = ((data[1] * 256) + data[2]) / 16;
		if(xAccl > 2047)
		{
			xAccl -= 4096;
		}

		int yAccl = ((data[3] * 256) + data[4]) / 16;
		if(yAccl > 2047)
		{
			yAccl -= 4096;
		}

		int zAccl = ((data[5] * 256) + data[6]) / 16;
		if(zAccl > 2047)
		{
			zAccl -= 4096;
		}

		// Output data to screen
		printf("Acceleration in X-Axis : %d \n", xAccl);
		printf("Acceleration in Y-Axis : %d \n", yAccl);
		printf("Acceleration in Z-Axis : %d \n", zAccl);
	}
}