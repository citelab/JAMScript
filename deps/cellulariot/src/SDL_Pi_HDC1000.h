/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
07-Nov-2018           Matthew L-K             Switch to file descriptor design
03-Dec-2018           Samuel G                Standardized interface
19-Mar-2019           Samuel G                Adapted for file abstraction layer
==================================================================*/

int HDC1080_open();

int read_temperature(int fd, int *data);

int read_humidity(int fd, int *data);