#include <stdlib.h>
#include <stdio.h>
#include <assert.h>
#include <stdarg.h>
#include <string.h>
#include "tboard.h"
#include "command.h"
#include "mqtt-adapter.h"
#include "cnode.h"
#include "constants.h"
#include "dpanel.h"

#ifdef SUPPORT_32_BIT
#define SNOWFLAKE_ID_FROM_TIME(ts) ts.tv_sec * 1000000 +  ts.tv_nsec / 1000;
#else
#define SNOWFLAKE_ID_FROM_TIME(ts) ts.tv_sec * 1000000000 +  ts.tv_nsec;
#endif

uint64_t mysnowflake_id() {
    static int counter = 0;
    counter = (counter + 1) % 10000;
    uint64_t x;
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    x = (uint64_t)SNOWFLAKE_ID_FROM_TIME(ts);
    return x/100 + counter;
}


////////////////////////////////////////
/////////// TASK FUNCTIONS /////////////
////////////////////////////////////////

bool task_create(tboard_t *t, function_t fn, void *args, void *cmd)
{
    if (t == NULL)
        return false;
    mco_result res;

    // create task_t object
    task_t *task = calloc(1, sizeof(task_t));
    task->status = TASK_INITIALIZED;
    task->type = fn.tasktype;
    task->id = TASK_ID_NONBLOCKING;
    task->fn = fn;
    // create description and populate it with argument
    task->desc = mco_desc_init((task->fn.fn), 0);
    task->desc.user_data = args;
    if (args != NULL) {
        arg_t *a = args;
        task->data_size = a[0].nargs;
    }
    task->cmd_obj = cmd;
    // non-blocking task so no parent
    task->parent = NULL;
    // create coroutine
    if ( (res = mco_create(&(task->ctx), &(task->desc))) != MCO_SUCCESS ) {
        tboard_err("task_create: Failed to create coroutine: %s.\n",mco_result_description(res));
        if (task->cmd_obj != NULL) command_free((command_t *)task->cmd_obj);
        free(task);
        return false;
    } else {
        // attempt to add task to tboard
        bool added = task_add(t, task);
        if (!added){
            mco_destroy(task->ctx); // we must destroy stack allocated in mco_create() on failure
            if (task->cmd_obj != NULL) command_free((command_t *)task->cmd_obj);
            free(task); // free task, as it turns out we cannot use it
        }
        return added;
    }
}

void task_destroy(task_t *task)
{
    printf("Task destroy called \n");
    if (task == NULL)
        return;
    // check if parent task exists. If it does, it is not in any ready
    // queue so we must destroy it (does it recursively)
    if (task->parent != NULL)
        task_destroy(task->parent);
    // destroy user data if applicable
    if (task->data_size > 0 && task->desc.user_data != NULL)
        free(task->desc.user_data);
    // destroy coroutine
    mco_destroy(task->ctx);
    if (task->cmd_obj != NULL) command_free((command_t *)task->cmd_obj);
    // free task_t
    free(task);
}

inline void task_yield()
{
    // yield currently running task
    mco_yield(mco_running());
}

inline void *task_get_args()
{
    // get arguments of currently running task
    return mco_get_user_data(mco_running());
}

void task_place(tboard_t *t, task_t *task)
{
    // add task to ready queue
    if(task->type <= PRI_BATCH_TASK || t->sqs == 0) {
        // task should be added to primary ready queue
        pthread_mutex_lock(&(t->pmutex)); // lock primary mutex
        struct queue_entry *task_q = queue_new_node(task); // create queue entry
        //printf("Task type %d\n", task->type);
        switch (task->type) {
            case PRI_SYNC_TASK:
                queue_insert_tail(&(t->pqueue_sy), task_q);
            break;
            case PRI_REAL_TASK:
                queue_insert_tail(&(t->pqueue_rt), task_q);
            break;
            case PRI_BATCH_TASK:
                queue_insert_tail(&(t->pqueue_ba), task_q);
        }
        pthread_cond_signal(&(t->pcond)); // signal primary condition variable as only one
                                          // thread will ever wait for pcond
        pthread_mutex_unlock(&(t->pmutex)); // unlock mutex
    } else {
        // task should be added to secondary ready queue
        int j = rand() % (t->sqs); // randomly select secondary queue
        pthread_mutex_lock(&(t->smutex[j])); // lock secondary mutex
        struct queue_entry *task_q = queue_new_node(task); // create queue entry
        queue_insert_tail(&(t->squeue[j]), task_q); // insert queue entry to tail
        pthread_cond_signal(&(t->scond[j])); // signal secondary condition variable as only
                                             // one thread will ever wait for pcond
        if (SIGNAL_PRIMARY_ON_NEW_SECONDARY_TASK == 1)
            pthread_cond_signal(&(t->pcond)); // signal primary condition variable
        pthread_mutex_unlock(&(t->smutex[j])); // unlock mutex
    }
}

bool task_add(tboard_t* t, task_t* task) {
    if (t == NULL || task == NULL)
        return false;

    // check if we have reached maximum concurrent tasks
    if(tboard_add_concurrent(t) == 0)
        return false;

    // initialize internal values
    task->cpu_time = 0;
    task->yields = 0;
    task->status = TASK_INITIALIZED;
    task->hist = NULL;
    // add task to history
    history_record_exec(t, task, &(task->hist));
    task->hist->executions += 1; // increase execution count
    // add task to ready queue
    task_place(t, task);
    return true;
}


/////////////////////////////////////////////////
/////////// BLOCKING TASK FUNCTIONS /////////////
/////////////////////////////////////////////////

arg_t* blocking_task_create(tboard_t* t, function_t fn, int type, arg_t* retarg, arg_t* args, size_t sizeof_args) {
    if (mco_running() == NULL) // must be called from a coroutine!
        return NULL;

    mco_result res;

    // create task object
    task_t task = {0};
    task.status = TASK_INITIALIZED;
    task.type = type; // tagged arbitrarily, will assume parents position
    task.id = TASK_ID_BLOCKING;
    task.fn = fn;
    task.desc = mco_desc_init((task.fn.fn), 0);
    task.desc.user_data = args;
    task.data_size = sizeof_args;
    task.parent = NULL;
    task.hist = NULL;

    // add task to history
    history_record_exec(t, &task, &(task.hist));
    task.hist->executions += 1; // increase execution count

    // create coroutine context
    res = mco_create(&(task.ctx), &(task.desc));
    if (res != MCO_SUCCESS) {
        tboard_err("blocking_task_create: Failed to create coroutine: %s.\n", mco_result_description(res));
        return NULL;
    } else { // context creation successful
        // push task_t to storage
        res = mco_push(mco_running(), &task, sizeof(task_t));
        if (res != MCO_SUCCESS) {
            tboard_err("blocking_task_create: Failed to push task to mco storage interface.\n");
            return NULL;
        }
        // yield so executor can run blocking task
        task_yield();

        // we got control back meaning blocking task should have executed.
        // check if task_t worth of memory is in storage
        if (mco_get_bytes_stored(mco_running()) == (sizeof(task_t) + sizeof(arg_t))) {
            // attempt to pop task_t from storage
            res = mco_pop(mco_running(), &task, sizeof(task_t));
            if (res != MCO_SUCCESS) {
                tboard_err("blocking_task_create: Failed to pop task from mco storage interface.\n");
                return NULL;
            }
            if (task.status == TASK_COMPLETED) { // task completed
                if (mco_get_bytes_stored(mco_running()) == sizeof(arg_t)) {
                    res = mco_pop(mco_running(), retarg, sizeof(arg_t));
                    return retarg;
                } else
                    return NULL;
            } else {
                tboard_err("blocking_task_create: Blocking task is not marked as completed: %d.\n", task.status);
                return NULL;
            }
        } else {
            tboard_err("blocking_task_create: Failed to capture blocking task after termination.\n");
            return NULL;
        }
    }
}

///////////////////////////////////////////////
/////////// REMOTE TASK FUNCTIONS /////////////
///////////////////////////////////////////////

/*
 * This call does not take task board as the first argument
 * Returns true on successful call and false otherwise. The actual remote call
 * is running asynchronously from the execution of the local task. We don't get
 * any return value from the remote side.
 */
bool remote_task_create_nb(tboard_t* tboard, char* command, int level, char* fn_argsig, arg_t* args, int sizeof_args) {
    if (mco_running() == NULL) // must be called from a coroutine!
        return false;

    mco_result res;
    // create rtask object
    remote_task_t rtask = {0};
    rtask.task_id = mysnowflake_id();
    rtask.status = TASK_INITIALIZED;
    rtask.data = args;
    rtask.data_size = sizeof_args;
    rtask.mode = TASK_MODE_REMOTE_NB;
    rtask.retries = TASK_MAX_RETRIES;
    rtask.level = level;
    strcpy(rtask.fn_argsig, fn_argsig);
    int length = strlen(command);
    if(length > MAX_MSG_LENGTH) {
        tboard_err("remote_task_create_nb: Command length exceeds maximum supported value (%d > %d).\n",length, MAX_MSG_LENGTH);
        return false;
    }
    // copy command to rtask object
    memcpy(rtask.command, command, length);
    // push rtask into storage. This copies memory in current thread so we dont have
    // to worry about invalid reads
    res = mco_push(mco_running(), &rtask, sizeof(remote_task_t));
    if (res != MCO_SUCCESS) {
        tboard_err("remote_task_create_nb: Failed to push remote task to mco storage interface.\n");
        return false;
    }
    // issued remote task, yield
    task_yield();
    return true;
}

// This call does not take task board as the first argument
arg_t* remote_task_create(tboard_t* tboard, char* command, int level, char* fn_argsig, arg_t* args, int sizeof_args) {
    if (mco_running() == NULL) // must be called from a coroutine!
        return NULL;

    mco_result res;
    // create rtask object
    remote_task_t rtask = {0};
    rtask.task_id = mysnowflake_id();
    rtask.status = TASK_INITIALIZED;
    rtask.data = args;
    rtask.data_size = sizeof_args;
    rtask.mode = TASK_MODE_REMOTE;      // This is blocking
    rtask.retries = TASK_MAX_RETRIES;
    rtask.level = level;
    strcpy(rtask.fn_argsig, fn_argsig);
    int length = strlen(command);
    if(length > MAX_MSG_LENGTH){
        tboard_err("remote_task_create: Command length exceeds maximum supported value (%d > %d).\n", length, MAX_MSG_LENGTH);
        return NULL;
    }

    // copy command to rtask object
    memcpy(rtask.command, command, length);
    // push rtask into storage. This copies memory in current thread so we dont have
    // to worry about invalid reads
    res = mco_push(mco_running(), &rtask, sizeof(remote_task_t));
    if (res != MCO_SUCCESS) {
        tboard_err("remote_task_create: Failed to push remote task to mco storage interface.\n");
        return NULL;
    }
    // issued remote task, yield
    task_yield();
    // we have resumed the coroutine .. so we have access to the previous values

    // blocking: get if remote_task_t is currently in storage. If so we must parse it
    if (mco_get_bytes_stored(mco_running()) == sizeof(remote_task_t)) {
        res = mco_pop(mco_running(), &rtask, sizeof(remote_task_t));
        if (res != MCO_SUCCESS) {
            tboard_err("remote_task_create: Failed to pop remote task from mco storage interface.\n");
            return NULL;
        } else if (rtask.status == RTASK_COMPLETED) {
            if (sizeof_args)
                command_args_free(args); // the rtask.data value will be overwritten with return args
            remote_task_free(tboard, rtask.task_id);
            return rtask.data;
        }
        tboard_err("remote_task_create: Blocking remote task is not marked as completed: %d.\n", rtask.status);
        return NULL;
    }
    tboard_err("remote_task_create: Failed to capture blocking remote task after termination.\n");
    return NULL;
}

// We are using the remote task for the sleep task create and management
bool sleep_task_create(tboard_t *tboard, int sval) {
    if (mco_running() == NULL) // must be called from a coroutine!
        return false;

    mco_result res;
    // create rtask object
    remote_task_t rtask = {0};
    rtask.task_id = mysnowflake_id();
    rtask.status = TASK_INITIALIZED;
    rtask.mode = TASK_MODE_SLEEPING;

    twheel_add_event(tboard, TW_EVENT_BEGIN_JSLEEP, clone_taskid(&(rtask.task_id)), getcurtime() + sval);

    // push rtask into storage. This copies memory in current thread so we dont have
    // to worry about invalid reads
    res = mco_push(mco_running(), &rtask, sizeof(remote_task_t));
    if (res != MCO_SUCCESS) {
        tboard_err("remote_task_create: Failed to push remote task to mco storage interface.\n");
        return false;
    }
    // issued remote task, yield
    task_yield();
    // we have resumed the coroutine .. so we have access to the previous values

    // blocking: get if remote_task_t is currently in storage. If so we must parse it
    if (mco_get_bytes_stored(mco_running()) == sizeof(remote_task_t)) {
        res = mco_pop(mco_running(), &rtask, sizeof(remote_task_t));
        if (res != MCO_SUCCESS) {
            tboard_err("sleep_task_create: Failed to pop mco storage interface.\n");
            return false;
        } else if (rtask.status == TASK_COMPLETED) {
            remote_task_free(tboard, rtask.task_id);
            return true;
        }
        tboard_err("sleep_task_create: Sleeping task is not marked as completed: %d.\n",rtask.status);
        return false;
    }
    tboard_err("sleep_task_create: Failed to capture sleeping task after termination.\n");
    return false;
}

// This is yet another reuse of remote task - this time to wait on the "broadcaster" or
// downward flow (dflow).
dflow_task_response_t dflow_task_create(tboard_t* tboard, void* entry) {
    if (mco_running() == NULL) // must be called from a coroutine!
        return (dflow_task_response_t) {NULL,0};

    mco_result res;
    // create rtask object
    remote_task_t rtask = {0};
    rtask.task_id = mysnowflake_id();
    rtask.status = TASK_INITIALIZED;
    rtask.mode = TASK_MODE_DFLOW;
    rtask.entry = entry;

    // push rtask into storage. This copies memory in current thread so we dont have
    // to worry about invalid reads
    res = mco_push(mco_running(), &rtask, sizeof(remote_task_t));
    if (res != MCO_SUCCESS) {
        tboard_err("remote_task_create: Failed to push remote task to mco storage interface.\n");
        return (dflow_task_response_t) {NULL,0};
    }
    // issued remote task, yield
    task_yield();
    // we have resumed the coroutine .. so we have access to the previous values

    // blocking: get if remote_task_t is currently in storage. If so we must parse it
    if (mco_get_bytes_stored(mco_running()) == sizeof(remote_task_t)) {
        res = mco_pop(mco_running(), &rtask, sizeof(remote_task_t));
        if (res != MCO_SUCCESS) {
            tboard_err("dflow_task_create: Failed to pop mco storage interface.\n");
            return (dflow_task_response_t) {NULL,0};
        } else if (rtask.status == DFLOW_TASK_COMPLETED) {
            remote_task_free(tboard, rtask.task_id);
            // reset the state of the entry..
            dftable_entry_t *dfentry = (dftable_entry_t *)entry;
            pthread_mutex_lock(&(dfentry->mutex));
            dfentry->state = NEW_STATE;
            pthread_mutex_unlock(&(dfentry->mutex));
            return (dflow_task_response_t) {rtask.data, rtask.data_size};
        }
        tboard_err("dflow_task_create: dflow task is not marked as completed: %d.\n",rtask.status);
        return (dflow_task_response_t) {NULL,0};
    }
    tboard_err("dflow_task_create: Failed to capture dflow task after termination.\n");
    return (dflow_task_response_t) {NULL,0};
}

void remote_task_free(tboard_t *t, uint64_t taskid) {
    remote_task_t* rtask = NULL;
    HASH_FIND(hh, t->task_table, &(taskid), sizeof(uint64_t), rtask);
    if (rtask != NULL) {
        HASH_DEL(t->task_table, rtask);
        free(rtask);
    }
}


void remote_task_destroy(remote_task_t *rtask) {
    if (rtask == NULL)
        return;
    // check if task is blocking. If it is, then we must destroy task
    if (rtask->mode == TASK_MODE_REMOTE) {
        // this will recursively destroy parents if nested blocking tasks have been issued
        task_destroy(rtask->calling_task);
    }
    // free alloc'd data if applicable
    if (rtask->data_size > 0 && rtask->data != NULL)
        command_args_free(rtask->data);
    // free rtask object
    free(rtask);
}


#define  send_command_to_server(X) do {                                 \
        cmd = command_new_using_arg(CmdNames_REXEC, rtask->mode == TASK_MODE_REMOTE ? 1 : 0, rtask->command, rtask->task_id, cn->core->device_id, "", rtask->fn_argsig, rtask->data); \
        mqtt_publish(X, cn->topics->requesttopic, cmd->buffer, cmd->length, cmd, 0); \
    } while (0)

void remote_task_place(tboard_t* t, remote_task_t* rtask) {
    cnode_t* cn = (cnode_t*)t->cnode;
    command_t* cmd;
    // check for valid taskboard and remote task
    if (t == NULL || rtask == NULL)
        return;

    twheel_add_event(t, TW_EVENT_REXEC_TIMEOUT, clone_taskid(&(rtask->task_id)), getcurtime() + REXEC_TIMEOUT);
    switch (rtask->level) {
    case ALL_LEVELS:
        send_command_to_server(cn->devserv->mqtt);
        for(int i = 0; i < cn->eservnum; i++)
            send_command_to_server(cn->edgeserv[i]->mqtt);
        if (cn->cloudserv != NULL) // TODO we do not allow device to call cloud
            send_command_to_server(cn->cloudserv->mqtt);
        break;

    case DEVICE_LEVEL:
        send_command_to_server(cn->devserv->mqtt);
        break;

    case EDGE_LEVEL:
        for(int i = 0; i < cn->eservnum; i++)
            send_command_to_server(cn->edgeserv[i]->mqtt);
        break;

    case CLOUD_LEVEL: // TODO we do not allow device to call cloud
        if (cn->cloudserv != NULL)
            send_command_to_server(cn->cloudserv->mqtt);
        break;
    }
    /*
     * The rtask was freed here.. not anymore we wait for the response to come from
     * the remote side. Then the entry should be removed from the task list and it
     * should be freed.
     */
}
