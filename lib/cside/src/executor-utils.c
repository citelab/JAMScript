#include "tboard.h"
#include "sleeping.h"

/* 
 * Dummy functions.. these are just name holders. The real operations are 
 * done by another set of functions.
 */
void dummy_next_schedule(void *arg)
{

}

void dummy_next_sy_slot(void *arg)
{

}

void dummy_next_rt_slot(void *arg)
{

}

void dummy_close_rt_slot(void *arg)
{

}

void dummy_next_sleep_event(void *arg)
{

}

void dummy_next_timeout_event(void *arg)
{

}

/*
 * This function is run to make a new schedule - from the one that is found 
 * in the taskboard - schedule object. The schedule has a specific length. 
 * At the end of the schedule - we put a TW_EVENT_INSTALL_SCHEDULE. For other 
 * types we install the proper event: TW_EVENT_RT_SCHEDULE, etc. 
 *
 * IMPORTANT: at bootstrap, we install a default schedule. if the schedule is 
 * received from the controller, then we install it. 
 * PARAMS: taskboard and end time
 */
void install_next_schedule(tboard_t *tb, long int etime)
{
    int k = 0;
    int indx;
    long int stime = getcurtime();
    stime = etime > stime ? etime : stime;
    printf(">>>>> Stime %lu\n", stime);
    long int sched_dur = tb->sched == NULL ? TW_DEFAULT_SCHEDULE_LEN : tb->sched->args[0].val.lval;

    twheel_add_event(tb, TW_EVENT_INSTALL_SCHEDULE, NULL, stime + sched_dur);
    if (tb->sched != NULL) {
        k++;
        indx = tb->sched->args[k].val.ival;
        for (int i  = 0; i < indx; i++) {
            k++;
            twheel_add_event(tb, TW_EVENT_RT_SCHEDULE, NULL, stime + tb->sched->args[k].val.lval);
        }
        indx = tb->sched->args[k].val.ival;
        for (int i  = 0; i < indx; i++) {
            k++;
            twheel_add_event(tb, TW_EVENT_SY_SCHEDULE, NULL, stime + tb->sched->args[k].val.lval);
        }
    }
}

/*
 * This function waits for the SY slot time.. using busy waiting.. so we can
 * precisely start the SY task at that point. This function does not start the task 
 * or even set the execution mode. We just wait until the correct time. 
 */
void wait_to_sy_slot(tboard_t *tb, void *arg, long int stime)
{
    long int tremain = stime - getcurtime();
    if (tremain > 0)
        smart_sleep(&(tb->sleeper), tremain);
}

/*
 * This function does the sleep event processing.
 */
void process_sleep_event(tboard_t *t, void *arg)
{
    remote_task_t *rtask = NULL;

    HASH_FIND_INT(t->task_table, ((long int *)arg), rtask);
    if (rtask != NULL)
    {
        if (rtask->calling_task != NULL)
        {
            rtask->status = TASK_JSLEEP_DONE;
            assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
            // place parent task back to appropriate queue - should be batch
            task_place(t, rtask->calling_task);
        }
    }
}

void process_timeout_event(tboard_t *t, void *arg)
{
    remote_task_t *rtask = NULL;

    HASH_FIND_INT(t->task_table, ((long int *)arg), rtask);
    if (rtask != NULL)
    {
        rtask->retries--;
        if (rtask->retries > 0) 
            remote_task_place(t, rtask);
    }
}