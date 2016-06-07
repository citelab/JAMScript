/*
The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

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

#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

#include <pthread.h>

#include "timer.h"
#include "nvoid.h"

void *timer_loop(void *arg);


timertype_t *timer_init(char *name)
{
    int i;

    timertype_t *tmr = (timertype_t *)calloc(1, sizeof(timertype_t));
    for (i = 0; i < MAX_EVENTS; i++)
        tmr->events[i] = NULL;

    tmr->numevents = 0;
    tmr->timerqueue = queue_new(true);
    tmr->name = strdup(name);

    int rval = pthread_create(&(tmr->tmrthread), NULL, timer_loop, (void *)tmr);
    if (rval != 0) {
        perror("ERROR! Unable to start the timer loop");
        exit(1);
    }

    #ifdef DEBUG_LVL1
        if (name != NULL)
            printf("Timer [%s] initialization done\n", name);
        else
            printf("Timer initialization done\n");
    #endif

    return tmr;
}


// Stop the thread, release the memory allocations, etc
//
bool timer_free(timertype_t *tmr)
{
    pthread_cancel(tmr->tmrthread);
    queue_delete(tmr->timerqueue);

    #ifdef DEBUG_LVL1
        if (tmr->name != NULL)
            printf("Timer [%s] initialization done\n", tmr->name);
        else
            printf("Timer initialization done\n");
    #endif

    free(tmr);
    return true;
}


bool timer_add_event(timertype_t *tmr, int timerval, bool repeat, char *tag, timercallback_f cback, void *arg)
{
    timerevent_t *tev = timer_create_event(timerval, repeat, tag, cback, arg);
    char buf[64];

    sprintf(buf, "ADDEVENT %p", tev);
    queue_enq(tmr->timerqueue, strdup(buf), strlen(buf));

    #ifdef DEBUG_LVL1
        if (tmr->name != NULL)
            printf("Add event [tag=%s] to Timer [%s] done\n", tag, tmr->name);
        else
            printf("Add event [tag=%s] to timer\n", tag);
    #endif

    return true;
}


bool timer_del_event(timertype_t *tmr, char *tag)
{
    char buf[64];

    sprintf(buf, "DELEVENT %s", tag);

    queue_enq(tmr->timerqueue, strdup(buf), strlen(buf));

    #ifdef DEBUG_LVL1
        if (tmr->name != NULL)
            printf("Delete event [tag=%s] from Timer [%s] done\n", tag, tmr->name);
        else
            printf("Delete event [tag=%s] from timer done\n", tag);
    #endif
    return true;
}


bool timer_cancel_next(timertype_t *tmr, char *tag)
{
    char buf[64];

    sprintf(buf, "CANCELEVENT %s", tag);

    queue_enq(tmr->timerqueue, strdup(buf), strlen(buf));

    #ifdef DEBUG_LVL1
        if (tmr->name != NULL)
            printf("Cancel event [tag=%s] to Timer [%s] done\n", tag, tmr->name);
        else
            printf("Cancel event [tag=%s] to timer done\n", tag);
    #endif
    return true;
}


// ============================================
// A bunch of private methods
// ============================================


timerevent_t *timer_create_event(int timerval, bool repeated, char *tag, timercallback_f cback, void *arg)
{
    timerevent_t *tev = (timerevent_t *)calloc(1, sizeof(timerevent_t));

    tev->timeoutval = timerval;
    tev->timeleft = timerval;
    tev->repeated = repeated;
    tev->tag = strdup(tag);
    tev->cback = cback;
    tev->arg = arg;                 // TODO: remote memory is pointed by this one.. need to clone?

    return tev;
}


void *timer_loop(void *arg)
{
    timertype_t *tmr = (timertype_t *)arg;
    nvoid_t *nv;
    int oldstate, oldtype;

    pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, &oldstate);
    pthread_setcanceltype(PTHREAD_CANCEL_ASYNCHRONOUS, &oldtype);

    while (1) {
        nv = queue_deq_timeout(tmr->timerqueue, 100);
        if (nv == NULL)
        {
            // Timeout happened.. walk through the events and fire the expired ones
            timer_decrement_and_fire_events(tmr);
        }
        else
        {
            char cmd[64], param[64];
            // Check whether we have an addition or deletion
            sscanf((char *)nv->data, "%s %s", cmd, param);

            if (strcmp(cmd, "ADDEVENT") == 0)
            {
                timerevent_t *tev;
                sscanf(param, "%p", &tev);
                timer_insert_event_record(tmr, tev);
            }
            else
            if (strcmp(cmd, "DELEVENT") == 0)
            {
                timer_delete_records_with_tag(tmr, param);
            }
            nvoid_free(nv);
        }
    }

}


void timer_decrement_and_fire_events(timertype_t *tmr)
{
    int i;

    for (i = 0; i < tmr->numevents; i++)
    {
        if (tmr->events[i] != NULL)
        {
            tmr->events[i]->timeleft -= 100;             // decrement the time left by 100 milliseconds
            if (tmr->events[i]->timeleft <= 0)
            {
                if (tmr->events[i]->repeated)
                {
                    if (tmr->events[i]->cback != NULL)
                        tmr->events[i]->cback(tmr->events[i]->arg);
                    tmr->events[i]->timeleft = tmr->events[i]->timeoutval;
                }
                else
                {
                    if (tmr->events[i]->cback != NULL)
                        tmr->events[i]->cback(tmr->events[i]->arg);
                    free(tmr->events[i]->tag);
                    free(tmr->events[i]);
                    tmr->events[i] = NULL;
                }

            }
        }

    }
}


// Insert the given record if a NULL record is found.
// Otherwise, bump up the count and insert the record at the end
//
void timer_insert_event_record(timertype_t *tmr, timerevent_t *tev)
{
    int i;

    for (i = 0; i < tmr->numevents; i++)
    {
        if (tmr->events[i] == NULL)
        {
            tmr->events[i] = tev;
            return;
        }
    }
    tmr->events[tmr->numevents] = tev;
    tmr->numevents++;
}


void timer_delete_records_with_tag(timertype_t *tmr, char *tag)
{
    int i, j;

    // free and NULL all records with matching tag
    for (i = 0; i < tmr->numevents; i++)
    {
        if (tmr->events[i] == NULL)
            continue;

        if (strcmp(tmr->events[i]->tag, tag) == 0)
        {
            free(tmr->events[i]->tag);
            free(tmr->events[i]);
            tmr->events[i] = NULL;
        }
    }

    // compact the timer events..
    i = 0; j = tmr->numevents;
    while (i < j)
    {
        while (tmr->events[i] != NULL)
            i++;
        while (tmr->events[j] == NULL)
            j--;

        if (i < j)
        {
            tmr->events[i] = tmr->events[j];
            tmr->events[j] = NULL;
        }
    }

    i = 0;
    while (tmr->events[i] != NULL)
        i++;
    tmr->numevents = i;
}


void timer_cancel_next_match_event(timertype_t *tmr, char *tag)
{
    int i;

    // scan all the events..
    for (i = 0; i < tmr->numevents; i++)
    {
        // skip null slots.. these events don't exist
        if (tmr->events[i] == NULL)
            continue;

        if (strcmp(tmr->events[i]->tag, tag) == 0)
            tmr->events[i]->timeleft = tmr->events[i]->timeoutval;
    }
}
