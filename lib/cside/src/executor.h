#ifndef __EXECUTOR_H_
#define __EXECUTOR_H_

#include <time.h>
/**
 * pexec_timeout - Timespec for primary task executor to timedwait on cond variable
 * 
 * Having primary task executor do timedwait instead of wait isn't necessary for most
 * purposes, however there is a specific rare race condition with worker-to-controller
 * tasks that could leave task board in a deadlock. The most elegant solution to this is
 * to have the primary executor do a timed-sleep so that TSeq can run occasionally when
 * all executors have no tasks to do
 */
struct timespec pexec_timeout = {
    .tv_sec = 0,
    .tv_nsec = 500000
};

#endif