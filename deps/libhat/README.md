# Libhat SIXFAB sensor interface

## APIs
int sopen(SENSOR_TYPE)

int sopen_adc(int channel, float gain)

int sread(int fd, int *buffer)

int sclose(int fd)

## Building and Testing
The makefile contains the implementation for compiling, linking, and testing files.<br>
Running the makefile with the `all` target cleans the target directory, compiles and links object files, and runs tests.<br>
To have the latest available compiled code for the APIs, run `make libhat.a`.<br>
To clean, compile, and test, run `make` or `make all`.
