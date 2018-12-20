# Cellulariot SIXFAB sensor interface

## APIs
The following APIs are made available for the Raspberry Pi3 SIXFAB shield sensors:<br>
A buffer is passed to the function to store data measurements. These calls are asynchronous.

For reading accelerometer measurements<br>
int read_acc(int *data) <br>

For reading ADC measurements<br>
int read_adc(int *data, int channel, float gain)<br>

For reading light measurements<br>
int read_lux(int *data)<br>

For reading temperature measurements<br>
int read_temp (int *data)<br>

For reading humidity measurements<br>
int read_hum (int *data)<br>

For reading GPS measurements<br>
int read_gps (int *data)<br>

## Building and Testing
The makefile contains the implementation for compiling, linking, and testing files.<br>
Running the makefile with the `all` target cleans the target directory, compiles and links object files, and runs tests.<br>
To have the latest available compiled code for the APIs, run `make cellulariot.a`.<br>
To clean, compile, and test, run `make all`.
