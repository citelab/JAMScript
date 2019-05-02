/* @author: Samuel G samuel.genois@mail.mcgill.ca

Modification Log:
Date                  Author                  Modification
-----------------------------------------------------------------
31-Oct-2018           Samuel G                Created the file
07-Nov-2018        Julien Courbebaisse        Updated to reflect new model
03-Dec-2018           Samuel G                Standardized interface
19-Mar-2019           Samuel G                Adapted for file abstraction layer
==================================================================*/

int MMA8452Q_open();

int read_acc(int fd, int *data);
