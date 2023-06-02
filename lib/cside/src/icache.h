#ifndef __REQUEST_ICACHE_H__
#define __REQUEST_ICACHE_H__

#include "uthash.h"
#include <stdbool.h>

#define MAX_ICACHE_ELEMS            512

struct id_entry {
    char id[128];
    UT_hash_handle hh;
};

typedef struct _icache_t
{
    int curtab;
    struct id_entry *tables[3];
    int nelems;
} icache_t;

icache_t *icache_alloc();
bool icache_insert(icache_t *ic, long int task_id, char *node_id);
bool icache_lookup(icache_t *ic, long int task_id, char *node_id);
void icache_free(icache_t *ic);

#endif
