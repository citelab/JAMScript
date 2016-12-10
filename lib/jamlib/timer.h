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

#ifndef __TIMER_H__
#define __TIMER_H__

#define MAX_EVENTS 					256

#include <pthread.h>

#include "simplequeue.h"

typedef void (*timercallback_f)(void *arg);

typedef struct _timerevent_t
{
	int timeoutval;
	bool repeated;
	int timeleft;						// in milliseconds
	char *tag;
	timercallback_f cback;
	void *arg;

} timerevent_t;


typedef struct _timertype_t
{
	char *name;
	int numevents;
	timerevent_t *events[MAX_EVENTS];
	simplequeue_t *timerqueue;
	pthread_t tmrthread;

} timertype_t;


timertype_t *timer_init(char *name);
bool timer_free(timertype_t *tmr);

bool timer_add_event(timertype_t *tmr, int timerval, bool repeat, char *tag, timercallback_f cback, void *arg);
bool timer_del_event(timertype_t *tmr, char *tag);
bool timer_cancel_next(timertype_t *tmr, char *tag);

// Private functions...

void *timer_loop(void *arg);
timerevent_t *timer_create_event(int timerval, bool repeated, char *tag, timercallback_f cback, void *arg);
void timer_decrement_and_fire_events(timertype_t *tmr);
void timer_insert_event_record(timertype_t *tmr, timerevent_t *tev);
void timer_delete_records_with_tag(timertype_t *tmr, char *tag);
void timer_cancel_next_match_event(timertype_t *tmr, char *tag);
#endif
