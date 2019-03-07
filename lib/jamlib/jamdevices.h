#ifndef __JAMDEVICES_H__
#define __JAMDEVICES_H__

#include "pushqueue.h"
#include <pthread.h>

typedef void* (*jdcallback_f)(void *arg);

typedef struct _jamdeventry_t
{
    int type;
    char *name;
    int mode;
    pushqueue_t *dataq;
    pthread_t tid;

} jamdeventry_t;


typedef struct _jamdevtable_t
{
    int size;
    jamdeventry_t *entries[32];

} jamdevtable_t;

typedef struct _jamtypeentry_t
{
    int type;

    jdcallback_f opencb;
    void *oarg;
    jdcallback_f readcb;
    void *rarg;

} jamtypeentry_t;

typedef struct _jamdevtypes_t
{
    int size;
    jamtypeentry_t *entries[32];

} jamdevtypes_t;


void jamdev_reg_callbacks(int type, jdcallback_f opencb, void *oarg, jdcallback_f readcb, void *rarg);
void insert_jtypeentry(jamdevtypes_t *jdtypes, jamtypeentry_t *jtype);
bool check4open(int type, char *name);
void insert_jdeventry(jamdevtable_t *jdtable, jamdeventry_t *jdev);
jamdeventry_t *get_jdeventry(jamdevtable_t *jdtable, int id);
jamtypeentry_t *get_jtypeentry(int type);

#endif
