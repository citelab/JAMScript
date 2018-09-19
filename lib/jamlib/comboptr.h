/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/

#ifndef __COMBOPTR_H__
#define __COMBOPTR_H__

typedef struct _comboptr_t
{
    void *arg1;
    void *arg2;
    void *arg3;
    int iarg;
    void **argv;
    unsigned long long lluarg;

} comboptr_t;


comboptr_t *create_combo2llu_ptr(void *arg1, void *arg2, unsigned long long lluarg);
comboptr_t *create_combo3_ptr(void *arg1, void *arg2, void *arg3);
comboptr_t *create_combo3i_ptr(void *arg1, void *arg2, void *arg3, int iarg);
comboptr_t *create_combo3ip_ptr(void *arg1, void *arg2, void *arg3, int iarg, void **argv);

#endif
