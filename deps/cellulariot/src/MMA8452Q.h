/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
==================================================================*/

typedef struct {
    //TODO
} MMA8452Q;

int MMA8452Q_open();

int MMA8452Q_read(int *data, int file);

int MMA8452Q_close();