/* This controls the primary executor and secondary executor */

#include <time.h>
#include <sys/time.h>
#include <pthread.h>
#include <assert.h>

#include "tboard.h"
#include "queue/queue.h"
#include "executor.h"
#include "constants.h"
#include "tprofiler.h"
#include "dpanel.h"

enum execmodes_t {
    BATCH_MODE_EXEC = 1,
    SYNC_MODE_EXEC = 2,
    RT_MODE_EXEC = 3
};


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

void convert_time_to_absolute(struct timespec *t, struct timespec *abt) {
    struct timeval tnow;
    gettimeofday(&tnow, NULL);
    abt->tv_sec = t->tv_sec + tnow.tv_sec;
    abt->tv_nsec = t->tv_nsec + tnow.tv_usec * 1000;
}


void process_timing_wheel(tboard_t* tboard, enum execmodes_t* mode) {
    twheel_update_to_now(tboard);
    struct timeout* t = NULL;
    *mode = BATCH_MODE_EXEC;

    do {
        t = twheel_get_next(tboard);
        if (t != NULL) {
            if (t->callback.fn == dummy_next_schedule) {
                install_next_schedule(tboard, t->expires);
            } else if (t->callback.fn == dummy_next_sy_slot) {
                *mode = SYNC_MODE_EXEC;
                wait_to_sy_slot(tboard, t->callback.arg, t->expires);
                free(t);
                break;
            } else if (t->callback.fn == dummy_next_rt_slot) {
                *mode = RT_MODE_EXEC;
                twheel_add_event(tboard, TW_EVENT_RT_CLOSE, NULL, t->expires + RT_SLOT_LEN);
                free(t);
                break;
            } else if (t->callback.fn == dummy_close_rt_slot) {
                *mode = BATCH_MODE_EXEC;
            } else if (t->callback.fn == dummy_next_sleep_event) {
                process_sleep_event(tboard, t->callback.arg);
            } else if (t->callback.fn == dummy_next_timeout_event) {
                process_timeout_event(tboard, t->callback.arg);
            }
            free(t->callback.arg);
            free(t);
        }
    } while (t != NULL);
}

struct queue_entry* get_next_task(tboard_t* tboard, int etype, enum execmodes_t mode, int num, struct queue** q, pthread_mutex_t** mutex, pthread_cond_t** cond) {
    struct queue_entry* next = NULL; // queue entry of ready queue

    if (etype == PRIMARY_EXECUTOR) { // we're in pExec
        // check if any primary tasks are waiting in primary ready queue
        pthread_mutex_lock(&(tboard->pmutex));
        *mutex = &(tboard->pmutex);
        *cond = &(tboard->pcond);
        switch (mode) {
        case SYNC_MODE_EXEC:
            *q = &(tboard->pqueue_sy);
            break;
        case RT_MODE_EXEC:
            *q = &(tboard->pqueue_rt);
            break;
        case BATCH_MODE_EXEC:
            *q = &(tboard->pqueue_ba);
            break;
        }
        next = queue_peek_front(*q);
        if (next)   // we found a primary task so we pop it
            queue_pop_head(*q);
        pthread_mutex_unlock(&(tboard->pmutex));
    } else { // we're in sExec, check if any task exists
        for (int i=0; i<tboard->sqs; i++) {
            // lock appropriate mutex
            pthread_mutex_lock(&(tboard->smutex[i]));
            *q = &(tboard->squeue[i]);
            next = queue_peek_front(*q);
            if (next) { // found a task to run, pop it and stop searching
                queue_pop_head(*q);
                *mutex = &(tboard->smutex[i]);
                *cond = &(tboard->scond[i]);
                pthread_mutex_unlock(&(tboard->smutex[i]));
                break;
            }
            pthread_mutex_unlock(&(tboard->smutex[i]));
        }
    }
    return next;
}

void process_next_task(tboard_t* tboard, int type, struct queue** q, struct queue_entry* next, pthread_mutex_t* mutex, pthread_cond_t* cond) {
    dftable_entry_t* entry;
    ////////// Get queue data, and swap context to function until task yields ///////////
    task_t *task = ((task_t *)(next->data));
    task->status = TASK_RUNNING; // update status incase first run
    // swap context to task - to start the execution
    // so.. we start the execution (by default) and then let it yield..
    // at yield the task would indicate the reason for yielding... which we
    // use to process accordingly...
    mco_resume(task->ctx);
    // check status of task
    int status = mco_status(task->ctx);
    if (status == MCO_SUSPENDED) { // task yielded
        task->yields++; // increment # yields of specific task
        task->hist->yields++; // increment total # yields in history hash table
        struct queue_entry* e = NULL;
        // check if task yielded with special instruction
        if (mco_get_bytes_stored(task->ctx) == sizeof(task_t)) {
            // indicative of blocking local task creation, so we must retrieve it
            task_t* subtask = calloc(1, sizeof(task_t)); // freed on termination
            assert(mco_pop(task->ctx, subtask, sizeof(task_t)) == MCO_SUCCESS);
            // save issuing task_t object in subtask task_t object
            subtask->parent = task;
            // place task in appropriate queue corresponding to subtask->type
            task_place(tboard, subtask);
        } else if (mco_get_bytes_stored(task->ctx) == sizeof(remote_task_t)) {
            // indicative of remote task creation, so we must retrieve it
            remote_task_t* rtask = calloc(1, sizeof(remote_task_t)); // freed on retrieval
            assert(mco_pop(task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
            // task issuing task_t object in remote task object
            rtask->calling_task = task;
            HASH_ADD(hh, tboard->task_table, task_id, sizeof(uint64_t), rtask);

            switch (rtask->mode) {
            case TASK_MODE_REMOTE_NB:
                e = queue_new_node(task);
                remote_task_place(tboard, rtask);
                break;
            case TASK_MODE_DFLOW:
                entry = (dftable_entry_t*)rtask->entry;
                // set the task state accordingly in the dftable_entry_t ..
                pthread_mutex_lock(&(entry->mutex));
                if (entry->state == NEW_STATE)
                    entry->state = CLIENT_READY;
                entry->taskid = rtask->task_id;
                pthread_mutex_unlock(&(entry->mutex));
                break;
            case TASK_MODE_SLEEPING:
                // nothing to do here. the task is already in the task table
                break;
            case TASK_MODE_REMOTE:
                remote_task_place(tboard, rtask);
            }

        } else { // just a normal yield, so we create node to reinsert task into queue
            // DO_SNAPSHOT(4);
            e = queue_new_node(task);
            // DO_SNAPSHOT(5);
        }

        if (e != NULL) {
            // DO_SNAPSHOT(6);
            // reinsert task into queue it was taken out of
            pthread_mutex_lock(mutex); // lock appropriate mutex
            switch (task->type) {
            case PRI_SYNC_TASK:
                queue_insert_tail(&(tboard->pqueue_sy), e);
                break;
            case PRI_REAL_TASK:
                queue_insert_tail(&(tboard->pqueue_rt), e);
                break;
            case PRI_BATCH_TASK:
                queue_insert_tail(&(tboard->pqueue_ba), e);
            }
            if(type == PRIMARY_EXECUTOR) pthread_cond_signal(cond); // we wish to wake secondary executors if they are asleep
            pthread_mutex_unlock(mutex);
            // DO_SNAPSHOT(7);
        }
    } else if (status == MCO_DEAD) { // task has terminated
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

        if (task->cmd_obj)
            free(task->cmd_obj);
        mco_destroy(task->ctx);
        // free task_t object
        free(task);
    } else
        printf("Unexpected status received: %d, will lose task.\n",status);
}

void process_internal_command(tboard_t* t, internal_command_t* ic) {
    remote_task_t* rtask = NULL;

    switch (ic->cmd) {
    case CmdNames_REXEC_ACK:
        HASH_FIND(hh, t->task_table, &(ic->task_id), sizeof(uint64_t), rtask);
        if (rtask != NULL) {
            rtask->status = RTASK_ACK_RECEIVED;
            // blocking task - put back the timeout at a future time
            if (rtask->mode == TASK_MODE_REMOTE) {
                rtask->status = RTASK_RES_PENDING;
                // TODO: args has a timeout value from remote - convert and add to the current time.
                twheel_add_event(t, TW_EVENT_REXEC_TIMEOUT, clone_taskid(&(rtask->task_id)), getcurtime() + globals_Timeout_REXEC_ACK_TIMEOUT);
            } else {
                // if not blocking, remove it from the task table and destroy the remote task entry
                HASH_DEL(t->task_table, rtask);
                remote_task_destroy(rtask);
            }
        }
        internal_command_free(ic);
        break;

    case CmdNames_REXEC_RES:
        // find the task
        HASH_FIND(hh, t->task_table, &(ic->task_id), sizeof(uint64_t), rtask);
        if (rtask != NULL) {
            rtask->data = ic->args;
            rtask->data_size = 1;
            if (rtask->calling_task != NULL) {
                rtask->status = RTASK_COMPLETED;
                assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
                // place parent task back to appropriate queue
                task_place(t, rtask->calling_task);
            }
            free(ic);
        } else
            internal_command_free(ic);
        break;

    case CmdNames_REXEC_ERR:
        // find the task
        HASH_FIND(hh, t->task_table, &(ic->task_id), sizeof(uint64_t), rtask);
        if (rtask != NULL) {
            if (rtask->calling_task != NULL) {
                rtask->status = RTASK_ERROR;
                assert(mco_push(rtask->calling_task->ctx, rtask, sizeof(remote_task_t)) == MCO_SUCCESS);
                // place parent task back to appropriate queue
                task_place(t, rtask->calling_task);
            } else {
                // if not blocking, remove it from the task table and destroy the remote task entry
                HASH_DEL(t->task_table, rtask);
                remote_task_destroy(rtask);
            }
        }
        internal_command_free(ic);
        break;
    }
}

void process_internal_queue(tboard_t* t) {
    struct queue_entry* next = NULL;
    pthread_mutex_lock(&t->iqmutex);
    next = queue_peek_front(&t->iq);
    if (next)
        queue_pop_head(&t->iq);
    pthread_mutex_unlock(&t->iqmutex);
    if (next){
        process_internal_command(t, next->data);
        free(next);
    }
}


void* executor(void* arg) {
    // get task board pointer and purpose from argument
    exec_t args = *((exec_t*)arg);
    tboard_t* tboard = args.tboard;
    // determine behavior based on arguments
    int type = args.type;
    int num = args.num;

    pthread_mutex_t* mutex = NULL; // mutex to lock for previous queue
    pthread_cond_t* cond = NULL; // condition variable to signal after insertion
    enum execmodes_t mode;

    // disable premature cancellation by tboard_kill() to ensure graceful terminations
    disable_thread_cancel();

    while (true) {
        DO_SNAPSHOT(0);
        // create single cancellation point
        set_thread_cancel_point_here();
        // process the timing wheel events
        DO_SNAPSHOT(1);
        process_timing_wheel(tboard, &mode);
        DO_SNAPSHOT(2);
        // mode = BATCH_MODE_EXEC;
        if (mode == BATCH_MODE_EXEC)
            process_internal_queue(tboard);

        //// define variables needed for each iteration
        struct queue_entry* next = NULL; // queue entry of ready queue
        // the following variables are to keep track of which secondary queue (if any)
        // task is taken out of. This is important to track for pExec after taking a task
        // out of a secondary queue when primary queue is empty
        struct queue* q = NULL; // queue entry to reinsert task into after yielding
        DO_SNAPSHOT(3);
        // Fetch next task to run
        next = get_next_task(tboard, type, mode, num, &q, &mutex, &cond);
        DO_SNAPSHOT(4);
        if (next) { // TExec found a task to run
            DO_SNAPSHOT(5);
            process_next_task(tboard, type, &q, next, mutex, cond);
            DO_SNAPSHOT(6);
            free(next);
            PRINT_SNAPSHOTS(1);
        } else {
            // empty queue, we sleep on appropriate condition variable until signal received
            if (type == PRIMARY_EXECUTOR) {
                DO_SNAPSHOT(7);
                timeout_t sleep_micros = twheel_get_sleep_duration(tboard, pexec_max_sleep);
                DO_SNAPSHOT(8);
                if(sleep_micros > 0) {
                    struct timespec pexec_timeout = {.tv_sec = 0, .tv_nsec = sleep_micros * 1000}; // NOTE: assumes max sleep is less than a second
                    conditional_timedwait(&(tboard->pmutex), &(tboard->pcond), &(pexec_timeout));
                }
                DO_SNAPSHOT(9);
            } else
                conditional_wait(&(tboard->smutex[num]), &(tboard->scond[num]));
        }
        // PRINT_SNAPSHOTS(10000);
    }
}
