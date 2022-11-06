#include "tboard.h"
#include "cnode.h"
#include "utilities.h"
#include <unistd.h>

void process_timing_wheel(tboard_t *tboard, enum execmodes_t *mode);

long int lgetcurtime()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000000 +  ts.tv_nsec/1000;
}

cnode_t *cn;
struct timeouts *twheel;

void run() 
{
    int mode;
    tboard_t *tb = cn->tboard;
    printf("Before for \n");
    for (int i = 0; i < 10000; i++) {
        twheel_add_event(cn->tboard, TW_EVENT_INSTALL_SCHEDULE, NULL, lgetcurtime() + 200000);
        printf("Loopp %d\n", i);
     //   process_timing_wheel(cn->tboard, &mode);        
        //ctime = getcurtime();
        pthread_mutex_lock(&tb->twmutex);
        timeouts_update(tb->twheel, (timeout_t)lgetcurtime());
        pthread_mutex_unlock(&tb->twmutex);

        printf("After processing timeing wheel.. \n");
        sleep(1);
    }
}


/*
void run() 
{
    long int ctime;
    struct timeout t;
    timeout_init(&t, TIMEOUT_ABS);
    t.callback.fn = dummy_next_schedule;
    t.callback.arg = "first";
    ctime = getcurtime();
    // add the timeout event to the wheel at time 500 units
 //   timeouts_add(((tboard_t *)cn->tboard)->twheel, &t, ctime + 5000000);
    timeouts_add(twheel, &t, ctime + 5000000);

    // this has to be fresh timeout event.. don't change the previous entry 'struct timeout t'
    // it won't work.
    struct timeout u;
    timeout_init(&u, TIMEOUT_ABS);

    // here is a way to set a callback handler - note that the callback is not executed by the timer. It is
    // made accessible by the event that becomes available (as the recent expiry)
    u.callback.fn = dummy_close_rt_slot;
    u.callback.arg = "second";
    ctime = getcurtime();
    // timeouts_add(((tboard_t *)cn->tboard)->twheel, &u, ctime + 1000000);
    timeouts_add(twheel, &u, ctime + 1000000);
    // we enter a third event: 500, 1000, 1500 in all

    struct timeout v;
    timeout_init(&v, TIMEOUT_ABS);
    v.callback.fn = dummy_next_schedule;
    v.callback.arg = "third";
    ctime = getcurtime();
    //timeouts_add(((tboard_t *)cn->tboard)->twheel, &v, ctime + 2000000);
    timeouts_add(twheel, &v, ctime + 2000000);

    ctime = getcurtime();
    // timeouts_update(((tboard_t *)cn->tboard)->twheel, ctime+ 1000000);
    timeouts_update(twheel, ctime+ 1000000);

    // this should return the first expired event
    //struct timeout *x = timeouts_get(((tboard_t *)cn->tboard)->twheel);
    struct timeout *x = timeouts_get(twheel);
    if (x == NULL)
        printf("No expired events\n");
    else {
        printf("Some expired events found %s \n", x->callback.arg);
        x->callback.fn(x->callback.arg);
    }

}

*/



int main(int argc, char **argv) 
{
    
    cn = (cnode_t *)calloc(1, sizeof(cnode_t));

    // get arguments
    cn->args = process_args(argc, argv);
    if (cn->args == NULL) {
        cnode_destroy(cn);
        terminate_error(true, "invalid command line");
    }

    // generate core
  //  cn->core = core_init(cn->args->port, cn->args->snumber);
//    if (cn->core == NULL) {
  //      cnode_destroy(cn);
    //    terminate_error(true, "cannot create the core");
    //}

    // Start the taskboard 
    cn->tboard = tboard_create(cn, cn->args->nexecs);
    //tboard_t *tb = (tboard_t *)calloc(1, sizeof(tboard_t));

 //   timeout_error_t err;
 //   twheel = timeouts_open(0, &err);

    twheel_add_event(cn->tboard, TW_EVENT_INSTALL_SCHEDULE, NULL, lgetcurtime() + 200000);
    
        // install_next_schedule(tboard, 0);
    pthread_t pt;
    pthread_create(&pt, NULL, run, NULL);
    pthread_join(pt, NULL);
    printf("After join\n");
 //   run();

//    twheel_add_event(tb, TW_EVENT_INSTALL_SCHEDULE, NULL, getcurtime());
    
   
}
