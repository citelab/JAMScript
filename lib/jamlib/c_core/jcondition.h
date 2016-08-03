#ifndef __JCONDITION__
#define __JCONDITION__

#include "duktape/duktape.h"
#include <stdlib.h>
#include "stdio.h"

#define JCOND_FILE_PATH "jcondition_context.txt"
#define JCOND_ERROR_MSG "Jcondition Failure"
#define JCOND_SUCCS_MSG "Jcondition Success"

//First we assume a context file exists, if not then well...
//This file name will be jcondition_context.txt
//We assume this file is in the same folder as the executable file

//The first series of function will be about reading the file and its properties ...
//To make it simple, we will only accept the following format
/*
{
  key:"value",
  .....
}

This may seem like json format but we will not tolerate nested objects. Only a key and its primitive value
*/

//In any case, we will read it into memory lazily when first needed ...

void refresh_jcondition();
void jcond_read_context(); //Reads our context file in memory
void jcond_init_duktape();
void jcond_free_duktape();
int jcond_exec_stmt();
void jcond_set_error(char *err_msg);
char *jcond_get_error();

#endif
