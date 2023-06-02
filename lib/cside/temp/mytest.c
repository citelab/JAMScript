#include <stdio.h>
#include "timeout.h"


/*
 * Timing wheel is a data structure for keeping events that have a time associated with it.
 * Looks good for holding schedules! May be we should build the schedule data structure around 
 * the timing wheel. 

 * Because timing wheel is just a data structure it is passive. Don't expect it to trigger any 
 * callbacks. You can put a callback into the data structure. When an event expires, you can 
 * have this callback called by the thread that is examining the timing wheel. 
 
 * The example below shows all major APIs in action.
 */

static void funcA(void *arg) {
    printf("Callback funcA called with args: %s\n", (char *)arg);
}

static void funcB(void *arg) {
    printf("Callback funcB called with args: %s\n", (char *)arg);
}



int main() {

    // create the timing wheel
    timeout_error_t err;
    struct timeouts *twheel = timeouts_open(0, &err);

    // create an timeout event entry - note that just the entry is initialized
    struct timeout t;
    timeout_init(&t, TIMEOUT_ABS);
    t.callback.fn = funcA;
    t.callback.arg = "first"; 
    // add the timeout event to the wheel at time 500 units
    timeouts_add(twheel, &t, 500);

    // this has to be fresh timeout event.. don't change the previous entry 'struct timeout t'
    // it won't work.
    struct timeout u;
    timeout_init(&u, TIMEOUT_ABS);

    // here is a way to set a callback handler - note that the callback is not executed by the timer. It is
    // made accessible by the event that becomes available (as the recent expiry)
    u.callback.fn = funcB;
    u.callback.arg = "second";
    timeouts_add(twheel, &u, 1000);    
    // we enter a third event: 500, 1000, 1500 in all

    struct timeout v;
    timeout_init(&v, TIMEOUT_ABS);
    v.callback.fn = funcB;
    v.callback.arg = "third";
    timeouts_add(twheel, &v, 1500);

    struct timeouts_it it = TIMEOUTS_IT_INITIALIZER(TIMEOUTS_PENDING);
    struct timeout *q = timeouts_next(twheel, &it);
    if (q) {
        printf("Some pending events....%s\n", q->callback.arg);
        if (q->callback.fn == funcA) 
            printf("Callback is the first AAAA function\n");
        else 
            printf("Callback is something else.. \n");
        //int xx = timeout_rem(twheel, q);
        printf("Remaining time %d\n", q->expires);
    }
    else 
        printf("No pending events...\n");

    q = timeouts_next(twheel, &it);
    if (q) {
        printf("Some pending events....%s\n", q->callback.arg);
        if (q->callback.fn == funcA) 
            printf("Callback is the first AAAA function\n");
        else 
            printf("Callback is something else.. \n");
        //int xx = timeout_rem(twheel, q);
        printf("Remaining time %d\n", q->expires);
    }
    else 
        printf("No pending events...\n");
    // check the wheel if there are any expired evants - we won't find any because the wheel did
    // move yet
    struct timeout *x = timeouts_get(twheel);
    if (x == NULL)
	printf("No expired events\n");
    else
	printf("Some expired events found \n");

    // Now move the wheel to point 500, so the first event would have expired.
    timeouts_update(twheel, 500);

    // this should return the first expired event
    x = timeouts_get(twheel);
    if (x == NULL)
	printf("No expired events\n");
    else {
	printf("Some expired events found \n");
	x->callback.fn(x->callback.arg);
    }

    // this should return no events.. because we just took the one at 500 that expired
    x = timeouts_get(twheel);
    if (x == NULL)
	printf("No expired events\n");
    else
	printf("Some expired events found \n");

    struct timeouts_it it2 = TIMEOUTS_IT_INITIALIZER(TIMEOUTS_EXPIRED);
    q = timeouts_next(twheel, &it2);
    if (q) 
        printf("Some pending events....\n");
    else 
        printf("No pending events...\n");

    // Now move the wheel to point 1500, so all events expire
    timeouts_update(twheel, 1500);

    // we should get an expired event here
    x = timeouts_get(twheel);
    if (x == NULL)
	printf("No expired events\n");
    else {
	printf("Some expired events found \n");
	// we are running the event handler....
	x->callback.fn(x->callback.arg);
    }

    // we should get the next event here
    x = timeouts_get(twheel);
    if (x == NULL)
	printf("No expired events\n");
    else {
	printf("Some expired events found \n");
	x->callback.fn(x->callback.arg);
    }

    q = timeouts_next(twheel, &it);
    if (q) 
        printf("Some pending events....\n");
    else 
        printf("No pending events...\n");
    
    // destroy the timing wheel
    timeouts_close(twheel);
}
