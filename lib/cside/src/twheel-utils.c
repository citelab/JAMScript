#include <time.h>
#include "cnode.h"
#include "timeout.h"
#include "tboard.h"

// All time allowances are in microseconds
#define EARLY_TIME_FOR_SCHEDULE         10000
#define EARLY_TIME_FOR_RT               10000
#define EARLY_TIME_FOR_SY               10000


long int getcurtime()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000000 +  ts.tv_nsec/1000;
}


struct timeouts *twheel_init() 
{
    timeout_error_t err;
    struct timeouts *tw = timeouts_open(0, &err);
    return tw;
}

bool twheel_add_event(struct timeouts *twheel, twheel_event_t type, void *arg, long int tval)
{
    // create an timeout event entry - note that just the entry is initialized
    struct timeout t;
    timeout_init(&t, TIMEOUT_ABS);
    long int atval = tval;
    switch (type) {
        case TW_EVENT_INSTALL_SCHEDULE:
            t.callback.fn = dummy_next_schedule;
            t.callback.arg = arg;
            atval -= EARLY_TIME_FOR_SCHEDULE;
        break;
        case TW_EVENT_RT_SCHEDULE:
            t.callback.fn = dummy_next_rt_slot;
            t.callback.arg = arg;
            atval -= EARLY_TIME_FOR_RT;
        break;
        case TW_EVENT_RT_CLOSE:
            t.callback.fn = dummy_close_rt_slot;
            t.callback.arg = arg;
        break;
        case TW_EVENT_SY_SCHEDULE:
            t.callback.fn = dummy_next_sy_slot;
            t.callback.arg = arg;
            atval -= EARLY_TIME_FOR_SY;
        break;
        case TW_EVENT_BEGIN_JSLEEP:
            t.callback.fn = dummy_next_sleep_event;
            t.callback.arg = arg;
        break;
        case TW_EVENT_REXEC_TIMEOUT:
            t.callback.fn = dummy_next_timeout_event;
            t.callback.arg = arg;
        break;
    }
    // add the timeout event to the wheel at the adjusted time
    timeouts_add(twheel, &t, atval);
    return true;
}

bool twheel_delete_timeout(struct timeouts *twheel, long int *id)
{
    struct timeouts_it it = TIMEOUTS_IT_INITIALIZER(TIMEOUTS_PENDING);
    struct timeout *q;
    
    while ((q = timeouts_next(twheel, &it)) != NULL) {
        if ((q->callback.fn == dummy_next_timeout_event) && (*(long int *)(q->callback.arg) == *id))
            break;
    }
    if (q != NULL) {
        timeouts_del(twheel, q);
        return true;
    }
    return false;
}

void twheel_update_to_now(struct timeouts *twheel)
{
    timeouts_update(twheel, getcurtime());
}



