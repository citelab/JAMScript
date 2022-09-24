/* This controls the primary executor and secondary executor */

#include <sys/time.h>
#include "tboard.h"
#include "queue/queue.h"
#include "executor.h"
#include <pthread.h>
#include <assert.h> // assert()

/**
 * Define some macros that are useful to keep the code compact
 */
#define  disable_thread_cancel() do {                           \
    pthread_setcancelstate(PTHREAD_CANCEL_DISABLE, NULL);       \
} while (0)

#define set_thread_cancel_point_here() do {                     \
    pthread_setcancelstate(PTHREAD_CANCEL_ENABLE, NULL);        \
    pthread_testcancel();                                       \
    pthread_setcancelstate(PTHREAD_CANCEL_DISABLE, NULL);       \
} while(0)

#define conditional_wait(X, Y) do {                             \
    pthread_mutex_lock(X);                                      \
    pthread_cond_wait(Y, X);                                    \
    pthread_mutex_unlock(X);                                    \
} while (0)

#define conditional_timedwait(X, Y, T) do {                     \
    struct timespec __wait_time;                                \
    pthread_mutex_lock(X);                                      \
    convert_time_to_absolute(T, &__wait_time);                  \
    pthread_cond_timedwait(Y, X, &__wait_time);                 \
    pthread_mutex_unlock(X);                                    \
} while (0);

void convert_time_to_absolute(struct timespec *t, struct timespec *abt) 
{
    struct timeval tnow;
    gettimeofday(&tnow, NULL);
    abt->tv_sec = t->tv_sec + tnow.tv_sec;
    abt->tv_nsec = t->tv_nsec + tnow.tv_usec * 1000;
}

void *executor(void *arg)
{
    // get task board pointer and purpose from argument
    exec_t args = *((exec_t *)arg);
    tboard_t *tboard = args.tboard;
    // determine behavior based on arguments
    int type = args.type;
    int num = args.num;
    long start_time, end_time;

    // disable premature cancellation by tboard_kill() to ensure graceful terminations
    disable_thread_cancel();
    
    while (true) {
        // create single cancellation point
        set_thread_cancel_point_here();
        // run sequencer
        task_sequencer(tboard);

        //// define variables needed for each iteration
        struct queue_entry *next = NULL; // queue entry of ready queue
        // the following variables are to keep track of which secondary queue (if any)
        // task is taken out of. This is important to track for pExec after taking a task
        // out of a secondary queue when primary queue is empty
        struct queue *q = NULL; // queue entry to reinsert task into after yielding
        pthread_mutex_t *mutex = NULL; // mutex to lock for previous queue
        pthread_cond_t *cond = NULL; // condition variable to signal after insertion

        ////// Fetch next process to run ////////
        if (type == PRIMARY_EXEC) { // we're in pExec
            // check if any primary tasks are waiting in primary ready queue
            pthread_mutex_lock(&(tboard->pmutex));
            mutex = &(tboard->pmutex);
            cond = &(tboard->pcond);
            q = &(tboard->pqueue);
            next = queue_peek_front(q);
            if (next) {  // we found a primary task so we pop it
                queue_pop_head(q);
            } else { // no primary tasks are ready, try to pull a secondary task from any
                     // secondary queue to execute
                for (int i=0; i<tboard->sqs; i++) {
                    // lock appropriate mutex
                    pthread_mutex_lock(&(tboard->smutex[i]));
                    q = &(tboard->squeue[i]);
                    next = queue_peek_front(q);
                    if (next) { // found a task to run, pop it and stop searching
                        queue_pop_head(q);
                        mutex = &(tboard->smutex[i]);
                        cond = &(tboard->scond[i]);
                        pthread_mutex_unlock(&(tboard->smutex[i]));
                        break;
                    }
                    pthread_mutex_unlock(&(tboard->smutex[i]));
                }
            }
            pthread_mutex_unlock(&(tboard->pmutex));
        } else { // we're in sExec, check if any task exists
            pthread_mutex_lock(&(tboard->smutex[num]));
            mutex = &(tboard->smutex[num]);
            cond = &(tboard->scond[num]);
            q = &(tboard->squeue[num]);
            next = queue_peek_front(q);
            if(next) queue_pop_head(q);
            pthread_mutex_unlock(&(tboard->smutex[num]));
        }

        if (next) { // TExec found a task to run
            ////////// Get queue data, and swap context to function until task yields ///////////
            task_t *task = ((task_t *)(next->data));
            task->status = TASK_RUNNING; // update status incase first run

            start_time = clock(); // record start time
            mco_resume(task->ctx); // swap context to task
            end_time = clock(); // record end time

            // record task iteration time in task_t
            task->cpu_time += (end_time - start_time);

            // check status of task
            int status = mco_status(task->ctx);
            if (status == MCO_SUSPENDED) { // task yielded
                task->yields++; // increment # yields of specific task
                task->hist->yields++; // increment total # yields in history hash table
                struct queue_entry *e = NULL;

                // check if task yielded with special instruction
                if (mco_get_bytes_stored(task->ctx) == sizeof(task_t)) {
                    // indicative of blocking local task creation, so we must retrieve it
                    task_t *subtask = calloc(1, sizeof(task_t)); // freed on termination
                    assert(mco_pop(task->ctx, subtask, sizeof(task_t)) == MCO_SUCCESS);
                    // save issuing task_t object in subtask task_t object
                    subtask->parent = task;
                    // place task in appropriate queue corresponding to subtask->type
                    task_place(tboard, subtask);
                } else if (mco_get_bytes_stored(task->ctx) == sizeof(remote_task_t)) {
                    // indicative of remote task creation, so we must retrieve it
                    remote_task_t *rtask = calloc(1, sizeof(remote_task_t)); // freed on retrieval
                    assert(mco_pop(task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
                    // task issuing task_t object in remote task object
                    rtask->calling_task = task;
                    HASH_ADD_INT(tboard->task_table, task_id, rtask);

                    // if task is not blocking we wish to reinsert issuing task back into ready queue
                    if (!rtask->blocking)
                        e = queue_new_node(task);
                    // place remote task into appropriate message queue
                    printf("Remote task placed... %d\n", rtask->blocking);
                    remote_task_place(tboard, rtask);

                } else { // just a normal yield, so we create node to reinsert task into queue
                    e = queue_new_node(task);
                }

                if (e != NULL){
                    // reinsert task into queue it was taken out of
                    pthread_mutex_lock(mutex); // lock appropriate mutex
                    if (REINSERT_PRIORITY_AT_HEAD == 1 && task->type == PRIORITY_EXEC)
                        queue_insert_head(q, e); // if specified put priority at head
                    else
                        queue_insert_tail(q, e); // put task in tail of appropriate queue
                    if(type == PRIMARY_EXEC) pthread_cond_signal(cond); // we wish to wake secondary executors if they are asleep
                    pthread_mutex_unlock(mutex);
                }
            } else if (status == MCO_DEAD) { // task has terminated
                printf("Terminated...\n");
                task->status = TASK_COMPLETED; // mark task as complete for history hash table
                // record task execution statistics into history hash table
                history_record_exec(tboard, task, &(task->hist)); 

                // check if task was blocking, if so we need to resume parent
                if (task->parent != NULL) { // blocking task just terminated, we wish to return parent to queue
                    // push result to coroutine storage so blocking_task_create() can process results

                    if (mco_get_bytes_stored(task->ctx) == sizeof(arg_t)) {
                        arg_t retarg;
                        mco_pop(task->ctx, &retarg, sizeof(arg_t));
                        mco_push(task->parent->ctx, &retarg, sizeof(arg_t));
                    }

                    assert(mco_push(task->parent->ctx, task, sizeof(task_t)) == MCO_SUCCESS);
                    // place parent back into appropriate queue
                    task_place(tboard, task->parent); // place parent back in appropriate queue
                } else {
                    // we only want to deincrement concurrent count for parent tasks ending
                    // since only one blocking task can be created at a time, and blocked task
                    // essentially takes the place of the parent. Of course, nesting blocked tasks
                    // should be done with caution as there is essentially no upward bound, meaning
                    // large levels of nested blocked tasks could exhaust memory
                    tboard_deinc_concurrent(tboard);
                }
                // if command object is specified, just free it. User data would be deallocated by itself
                
                if (task->cmd_obj) {
                    command_free((command_t *)task->cmd_obj);       // FIXME: THis is conflicting with release in the wrapper
                    printf("Releasing the command object...\n");
                }
            //    else {
                    // FIXME: Arg free must be fixed. It is done in applications in the "wrapper"
                    // FIXME: Should it be done in application or here? What about command release in 197?
                    // Otherwise, check user data if specified and not null, we free it  
            //        if (task->data_size > 0 && task->desc.user_data != NULL)
            //            free(task->desc.user_data);  
            //    }
                // destroy context
                mco_destroy(task->ctx);
                // free task_t object
                free(task);
            } else {
                printf("Unexpected status received: %d, will lose task.\n",status);
            }
            // free queue entry
            free(next);
        } else {
            // empty queue, we sleep on appropriate condition variable until signal received
            if (type == PRIMARY_EXEC) {
                conditional_timedwait(&(tboard->pmutex), &(tboard->pcond), &(pexec_timeout));
            } else
                conditional_wait(&(tboard->smutex[num]), &(tboard->scond[num]));
        }
    }
}