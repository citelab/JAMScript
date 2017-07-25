/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/

#include "simplelist.h"
#include <stdlib.h>


list_elem_t *create_list()
{
    list_elem_t *t = (list_elem_t *)calloc(1, sizeof(list_elem_t));
    t->prev = t;
    t->next = t;
    t->data = strdup("HEAD");
    t->datalen = strlen(t->data);

    return t;
}


int list_length(list_elem_t *head)
{
    list_elem_t *p = head;
    int i = 0;

    while(p->next != p)
        i++;

    return i;
}


nvoid_t *get_list_head(list_elem_t *head)
{
    list_elem_t *p;
    if (head->next != head)
    {
        p = head->next;
        head->next->next->prev = head;
        head->next = head->next->next;

        nvoid_t *nv = nvoid_new(p->data, p->datalen);
        return nv;
    }
    else
        return NULL;
}


int put_list_tail(list_elem_t *head, void *data, int len)
{
    list_elem_t *t = (list_elem_t *)calloc(1, sizeof(list_elem_t));

    t->next = head;
    t->prev = head->prev;
    head->prev->next = t;
    head->prev = t;

    t->data = data;
    t->datalen = len;

    return t->datalen;
}
