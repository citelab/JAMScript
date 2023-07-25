#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>

#include <stdbool.h>

void terminate_error(bool terminate, const char *format, ...){
    va_list arglist;

    printf("ERROR!: ");
    va_start(arglist, format);
    vprintf(format, arglist);
    va_end(arglist);
    printf("\n");
    if (terminate) 
        exit(1);
}