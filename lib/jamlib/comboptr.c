/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/

#include "comboptr.h"
#include <stdlib.h>

comboptr_t *create_combo2llu_ptr(void *arg1, void *arg2, size_t size, unsigned long long lluarg)
{
    comboptr_t *cptr = (comboptr_t *)calloc(1, sizeof(comboptr_t));

    if (cptr != NULL)
    {
        cptr->arg1 = arg1;
        cptr->arg2 = arg2;
        cptr->size = size;
        cptr->lluarg = lluarg;


        return cptr;
    }

    return NULL;
}

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

comboptr_t *create_combo3i_ptr(void *arg1, void *arg2, void *arg3, int iarg)
{
    comboptr_t *cptr = (comboptr_t *)calloc(1, sizeof(comboptr_t));

    if (cptr != NULL)
    {
        cptr->arg1 = arg1;
        cptr->arg2 = arg2;
        cptr->arg3 = arg3;
        cptr->iarg = iarg;

        return cptr;
    }

    return NULL;
}

comboptr_t *create_combo3ip_ptr(void *arg1, void *arg2, void *arg3, int iarg, void **argv)
{
    comboptr_t *cptr = create_combo3i_ptr(arg1, arg2, arg3, iarg);
    if (cptr != NULL)
    {
        cptr->argv = argv;
        return cptr;
    }
    else
        return NULL;
}
