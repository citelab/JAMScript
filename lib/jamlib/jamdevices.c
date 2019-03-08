/*
The MIT License (MIT)
Copyright (c)   2017 Muthucumaru Maheswaran

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*
    This module is responsible for interfacing with outside devices.
    We can interface to FIFOs, or custom hardware like Analog-to-Digital convertors
    using this module. This design is tested on a Raspberry Pi HAT for LTE
    and other sensors.
*/

#include "jam.h"
#include "jamdevices.h"

jamdevtable_t *jdtable;
jamdevtypes_t *jdtypes;


//
// TODO: Revise the type table with a Hash table data structure.
//


/*
 * This initializes the JAM Devices subsystem.
 */
void jamdev_init()
{
    jdtable = (jamdevtable_t *)calloc(1, sizeof(jamdevtable_t));
    jdtypes = (jamdevtypes_t *)calloc(1, sizeof(jamdevtypes_t));

    jdtable->size = 0;
    jdtypes->size = 0;
}


// Insert the type into the type table. If the type is already there, we overwrite
// the entry with the new specification. With a new entry, we will increment type entry
// size..
//
void jamdev_reg_callbacks(int type, jdcallbacki_f opencb, void *oarg, jdcallbackii_f readcb, void *rarg)
{
    // TODO: hash table badly needed here!

    jamtypeentry_t *jtype = (jamtypeentry_t *)calloc(1, sizeof(jamtypeentry_t));
    jtype->type = type;
    jtype->opencb = opencb;
    jtype->oarg = oarg;
    jtype->readcb = readcb;
    jtype->rarg = rarg;

    insert_jtypeentry(jdtypes, jtype);
}

void *bgreader(void *arg)
{
    int oldtype;
    pthread_setcanceltype(PTHREAD_CANCEL_ASYNCHRONOUS, &oldtype);

    jamdeventry_t *jde = (jamdeventry_t *)arg;
    jamtypeentry_t *jtype = get_jtypeentry(jde->type);

    while(1) {
        int x = jtype->readcb(jde->fd);
        pqueue_enq(jde->dataq, &x, sizeof(x));
    }
}


// Search the table for the same type and name, if found return fail
//
// create entry - put it in the table
// open the device using callback as part of the initialization
// create the thread to service the device
// pass the table entry to it the thread.
// thread runs the entry and pushes the data to the queue..
//
int jopen(int type, char *name, int mode)
{
    // return fail if already open
    if (check4open(type, name))
        return -1;

    jamtypeentry_t *jtype = get_jtypeentry(type);
    jamdeventry_t *jdev = (jamdeventry_t *)calloc(1, sizeof(jamdeventry_t));
    // fill up the entry
    jdev->type = type;
    jdev->name = name;
    jdev->mode = mode;
    jdev->dataq = pqueue_new(true);   // TODO: check again.. should it be true?

    // open the device...
    int rval = jtype->opencb((void *)name);
    if (rval >= 0)
    {
        jdev->fd = rval;
        // insert the entry
        int fid = insert_jdeventry(jdtable, jdev);
        // create the thread for handling the request
        pthread_create(&(jdev->tid), NULL, bgreader, (void *)jdev);
        return fid;
    } else
    {
        pqueue_delete(jdev->dataq);
        free(jdev);
        return -1;
    }
}


// Read data from the queue.
// Blocks on the queue.. without blocking the JAMScript program...
//
int jread(int id, char *buf, int *len)
{
    jamdeventry_t *jdev = get_jdeventry(jdtable, id);
    // return -1 if the entry is not found
    if (jdev == NULL)
        return -1;

    // Waits in a non blocking way...
    nvoid_t *nv = pqueue_deq(jdev->dataq);
    if (nv != NULL)
    {
        buf = (char *)nv->data;
        free(nv);

        *len = strlen(buf);
    }
    return strlen(buf);
}

// just free the entry and annul it.
// we need to terminate the handler thread before closing the entry
//
void jclose(int id)
{

}

// Push the data into the queue .. and return
// The handler is responsible for pulling the data
// from the queue and sending it on to the device..
// So there would be another thread..?
// The question is whether we could have just one thread for both
// reading and writing.. it just watches both sides using poll/select?
// Or have two different threads..
//
// This is not yet implemented!
//
int jwrite(int id, char *buf, int len)
{

    return 0;
}


//
// Private functions...
//

//
// Search through the jdtypes table. if found overwrite the entry
//
void insert_jtypeentry(jamdevtypes_t *jdtypes, jamtypeentry_t *jtype)
{
    int i;
    for (i = 0; i < jdtypes->size; i++)
    {
        if (jdtypes->entries[i]->type == jtype->type)
        {
            free(jdtypes->entries[i]);
            jdtypes->entries[i] = jtype;
            return;
        }
    }
    i = jdtypes->size++;
    jdtypes->entries[i] = jtype;
}

bool check4open(int type, char *name)
{
    int i;
    for (i = 0; i < jdtable->size; i++)
    {
        if (jdtable->entries[i])
        {
            if (jdtable->entries[i]->type == type && strcmp(jdtable->entries[i]->name, name) == 0)
                return true;
        }
    }
    return false;
}

// Return the slot occupied by the new entry..
//
int insert_jdeventry(jamdevtable_t *jdtable, jamdeventry_t *jdev)
{
    int i;
    // insert in a blank spot if there is one..
    for (i = 0; i < jdtable->size; i++)
    {
        if (!jdtable->entries[i])
        {
            // insert it here and return ..
            jdtable->entries[i] = jdev;
            return i;
        }
    }
    // make a new entry and return...
    i = jdtable->size++;
    jdtable->entries[i] = jdev;
    return i;
}


jamdeventry_t *get_jdeventry(jamdevtable_t *jdtable, int id)
{
    return jdtable->entries[id];
}

jamtypeentry_t *get_jtypeentry(int type)
{
    int i;

    for (i = 0; i < jdtypes->size; i++)
    {
        if (jdtypes->entries[i]->type == type)
            return jdtypes->entries[i];
    }

    return NULL;
}
