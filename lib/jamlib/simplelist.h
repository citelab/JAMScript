/*
The MIT License (MIT)
Copyright (c) 2017 Muthucumaru Maheswaran
*/

#ifndef __SIMPLELIST_H__
#define __SIMPLELIST_H__

#include "nvoid.h"

typedef struct _list_elem_t
{
    void *data;
    int datalen;
    struct _list_elem_t *next;
    struct _list_elem_t *prev;
} list_elem_t;


list_elem_t *create_list();
int list_length(list_elem_t *lst);
nvoid_t *get_list_head(list_elem_t *lst);
int put_list_tail(list_elem_t *lst, void *data, int len);

#endif
