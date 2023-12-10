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
void install_next_schedule(tboard_t *tb, timeout_t etime)
{
    timeout_t stime = getcurtime();
    stime = etime > stime ? etime : stime;

    pthread_mutex_lock(&tb->schmutex);
    twheel_add_event(tb, TW_EVENT_INSTALL_SCHEDULE, NULL, stime + tb->sched.len);
    for (int i  = 0; i < tb->sched.rtslots; i++)
        twheel_add_event(tb, TW_EVENT_RT_SCHEDULE, NULL, stime + tb->sched.rtstarts[i]);
    for (int i  = 0; i < tb->sched.syslots; i++)
        twheel_add_event(tb, TW_EVENT_SY_SCHEDULE, NULL, stime + tb->sched.systarts[i]);
    pthread_mutex_unlock(&tb->schmutex);
}

/*
 * This function waits for the SY slot time.. using busy waiting.. so we can
 * precisely start the SY task at that point. This function does not start the task
 * or even set the execution mode. We just wait until the correct time.
 */
void wait_to_sy_slot(tboard_t *tb, void *arg, timeout_t stime)
{
    timeout_t tremain = stime - getcurtime();
    if (tremain > 0)
        smart_sleep(&(tb->sleeper), tremain);
}

/*
 * This function does the sleep event processing.
 */
void process_sleep_event(tboard_t *t, void *arg)
{
    remote_task_t *rtask = NULL;

    HASH_FIND(hh, t->task_table, ((uint64_t*)arg), sizeof(uint64_t), rtask);
    if (rtask != NULL)
    {
        if (rtask->calling_task != NULL)
        {
            rtask->status = TASK_COMPLETED;
            assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
            // place parent task back to appropriate queue - should be batch
            task_place(t, rtask->calling_task);
        }
    }
}

void process_timeout_event(tboard_t *t, void *arg)
{
    remote_task_t *rtask = NULL;

    if (arg != NULL) {
        HASH_FIND(hh, t->task_table, ((uint64_t*)arg), sizeof(uint64_t), rtask);
        if (rtask != NULL)
        {
            if (rtask->status == RTASK_ACK_PENDING || rtask->status == RTASK_RES_PENDING) {
                rtask->retries--;
                if (rtask->retries > 0)
                    remote_task_place(t, rtask);
            }
        }
    }
}
