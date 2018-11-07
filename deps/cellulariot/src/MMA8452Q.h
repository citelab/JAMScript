/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
==================================================================*/

typedef struct {
    //TODO
} MMA8452Q;

int MMA8452Q_init(MMA8452Q *handle);

int readAcc(MMA8452Q *handle, int *data);