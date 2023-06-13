#ifndef __EXECUTOR_H_
#define __EXECUTOR_H_
/**
 * pexec_max_sleep - Number of microseconds for primary task executor to timedwait on cond variable
 *
 * Should be less than a second
 *
 * Having primary task executor do timedwait instead of wait isn't necessary for most
 * purposes, however there is a specific rare race condition with worker-to-controller
 * tasks that could leave task board in a deadlock. The most elegant solution to this is
 * to have the primary executor do a timed-sleep so that TSeq can run occasionally when
 * all executors have no tasks to do
 */
int pexec_max_sleep = 500;

#endif
