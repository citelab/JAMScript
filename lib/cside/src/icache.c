#include "icache.h"
#include <stdio.h>
#include <stdbool.h>
#include "uthash.h"

void clean_icache(struct id_entry *t)
{
    struct id_entry *cur, *tmp;
    HASH_ITER(hh, t, cur, tmp) {
        HASH_DEL(t, cur);
        free(cur);
    }
}

void switch_icache(icache_t *ic)
{
    ic->curtab = (ic->curtab + 1) % 3;
    int cleantab = (ic->curtab - 2) % 3;
    clean_icache(ic->tables[cleantab]);
    ic->tables[cleantab] = NULL;
}

icache_t *icache_alloc()
{
    icache_t *ic = (icache_t *)calloc(1, sizeof(icache_t));
    if (ic == NULL) {
        perror("icache_alloc");
        exit(1);
    }
    // calloc should have done the 0 inii, so the following is redundant
    ic->curtab = 0;
    ic->nelems = 0;
    ic->tables[0] = NULL;
    ic->tables[1] = NULL;
    ic->tables[2] = NULL;

    return ic;
}

bool icache_insert(icache_t *ic, long int task_id, char *node_id)
{
    char buf[1024];
    sprintf(buf, "%lu%s", task_id, node_id);
    struct id_entry *entry = (struct id_entry *)calloc(1, sizeof(struct id_entry));
    strncpy(entry->id, buf, 128);
    HASH_ADD_STR(ic->tables[ic->curtab], id, entry);
    ic->nelems++;
    if (ic->nelems > MAX_ICACHE_ELEMS) {
        ic->nelems = 0;
        switch_icache(ic);
    }
    return true;
}

bool icache_lookup(icache_t *ic, long int task_id, char *node_id)
{
    struct id_entry *entry = NULL;
    char buf[1024];
    sprintf(buf, "%lu%s", task_id, node_id);
    HASH_FIND_STR(ic->tables[ic->curtab], buf, entry);
    if (entry) 
        return true;
    else {
        int prevtab = (ic->curtab - 1) % 3;
        HASH_FIND_STR(ic->tables[prevtab], buf, entry);
        if (entry)
            return true;
        else 
            return false;
    }
}
