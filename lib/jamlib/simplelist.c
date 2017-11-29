/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran
*/

#include "simplelist.h"
#include <stdlib.h>
#include <stdio.h>


list_elem_t *create_list()
{
    list_elem_t *t = (list_elem_t *)calloc(1, sizeof(list_elem_t));
    t->prev = t;
    t->next = t;
    t->data = strdup("HEAD");
    t->datalen = strlen(t->data);

    t->count = 0;

    return t;
}


int list_length(list_elem_t *head)
{
    return head->count;
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

    head->count++;

    return t->datalen;
}

void print_list(list_elem_t *head)
{
    list_elem_t *p = head->next;

    while (p != head)
    {
        printf("Data: %s\n", p->data);
        p = p->next;
    }
}


void del_list_tail(list_elem_t *head)
{
    // Pointer to the deleted item
    list_elem_t *tail = head->next;

    // Unlink the item
    head->next->next->prev = head->next->prev;
    head->next = head->next->next;

    // Release the memory
    if (strcmp(tail->data, "HEAD") != 0)
        free(tail);

    if (head->count > 0)
        head->count--;
}


void del_list_item(list_elem_t *head, void *e)
{
    list_elem_t *p = head->next;

    while ((p != head) && (p->data != e))
        p = p->next;


    if (p->data == e)
    {
        p->next->prev = p->prev;
        p->prev->next = p->next;

        free(p);

        if (head->count > 0)
            head->count--;
    }
}




bool find_list_item(list_elem_t *head, char *str)
{
    list_elem_t *p = head->next;

    while (p != head)
    {
        if (strcmp(str, p->data) == 0)
            return true;
        p = p->next;
    }
    return false;
}


void *search_item(list_elem_t *head, char *key, search_method_f sfunc)
{
    list_elem_t *p = head->next;

    while (p != head)
    {
        if (sfunc(p->data, key) == 0)
            return p->data;
        p = p->next;
    }
    return NULL;
}

/*
void test()
{
    list_elem_t *t = NULL;
    char *p = "ddd";
    bool q;

    q = search_list(t, p, searchq);// , p); //, searchq);
}
*/
