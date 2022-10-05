#include "timeout.h"

struct timeouts *twheel_init() 
{
    timeout_error_t err;
    struct timeouts *tw = timeouts_open(0, &err);
    
    return tw;
}

bool twheel_add_event()
{


}

bool twheel_schedule_event_before()
{


}


