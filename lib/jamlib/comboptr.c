/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/

#include "comboptr.h"
#include <stdlib.h>

comboptr_t *create_combo3_ptr(void *arg1, void *arg2, void *arg3)
{
    comboptr_t *cptr = (comboptr_t *)calloc(1, sizeof(comboptr_t));

    if (cptr != NULL)
    {
        cptr->arg1 = arg1;
        cptr->arg2 = arg2;
        cptr->arg3 = arg3;

        return cptr;
    }

    return NULL;
}