/*
The MIT License (MIT)
Copyright (c) 2017 Muthucumaru Maheswaran
*/

#ifndef __SIMPLELIST_H__
#define __SIMPLELIST_H__

#include <string.h>
#include <stdbool.h>
#include "nvoid.h"

typedef struct _list_elem_t
{
    void *data;
    int datalen;
    struct _list_elem_t *next;
    struct _list_elem_t *prev;

    // Count is only useful in the head
    int count;

} list_elem_t;

typedef int (*search_method_f)(void *elem, void *arg);

list_elem_t *create_list();

int list_length(list_elem_t *lst);
nvoid_t *get_list_head(list_elem_t *lst);
int put_list_tail(list_elem_t *lst, void *data, int len);
void print_list(list_elem_t *head);

// To implement a simple (inefficient) cache..
void del_list_item(list_elem_t *head, void *e);
void del_list_tail(list_elem_t *lst);
bool find_list_item(list_elem_t *lst, char *elem);
void *search_item(list_elem_t *lst, char *key, search_method_f sfunc);
#endif
