/* The main header file for our project */

#ifndef __TBOARD_H__
#define __TBOARD_H__

#include <sys/queue.h>
#include "queue/queue.h"
#include <minicoro.h>
#include <uthash.h>
#include <stdbool.h>
#include <pthread.h>
#include "timeout.h"
#include "command.h"
#include "sleeping.h"
#include "icache.h"
#include "jcond.h"

///////////////////////////////
///// Configurable Macros  ////
///////////////////////////////

#define MAX_TASKS 65536 // 8196
#define MAX_SECONDARIES 10
#define STACK_SIZE 57344 // 37344 // in bytes
#define REINSERT_PRIORITY_AT_HEAD 1

#define DEBUG 0

#define SIGNAL_PRIMARY_ON_NEW_SECONDARY_TASK 1
/**
 *  This will wake up primary executor when a
 *  secondary task is inserted into the task queue
 *  this allows primary task to take some of the slack
 *  from the secondary queue. If this is set to 0, primary
 *  executor will only be awoken if a primary task is added to
 *  the task board, regardless of the number of new secondary tasks
 */

/////////////////////////
//// State definitions
/////////////////////////
#define PRIMARY_EXECUTOR        1
#define SECONDARY_EXECUTOR      2

#define TASK_EXEC 0 // for msg_processor
#define TASK_SCHEDULE 1 // for msg_processor

#define TASK_ID_REMOTE_ISSUED -1
#define TASK_ID_NONBLOCKING 0
#define TASK_ID_BLOCKING 1

#define REXEC_TIMEOUT                   100000

enum task_types_t {
    PRI_SYNC_TASK = 1,
    PRI_REAL_TASK = 2,
    PRI_BATCH_TASK = 3,
    SEC_BATCH_TASK = 4
};

enum task_status_codes_t {
    TASK_INITIALIZED = 1,
    TASK_RUNNING = 2,
    TASK_COMPLETED = 5,
};

enum rtask_status_codes_t {
    RTASK_ACK_PENDING = 1,
    RTASK_ACK_RECEIVED = 2,
    RTASK_RES_PENDING = 3,
    RTASK_COMPLETED = 4,
    RTASK_ERROR = 5,
    DFLOW_TASK_COMPLETED = 6
};

#define TASK_MAX_RETRIES 3

#define MAX_MSG_LENGTH 254
#define MAX_ARG_LENGTH 32

#define RT_SLOT_LEN     500            // in microseconds

#define RTASK_SEND 1
#define RTASK_RECV 0

// Set MCO values
#define MCO_DEFAULT_STACK_SIZE STACK_SIZE


///////////////////////////////////////////////////////////////////
///////////////////////// Important Typedefs //////////////////////
///////////////////////////////////////////////////////////////////

/**
 * context_t - Coroutine context type.
 * As we are using minicoro library to handle coroutines, type is mco_coro*
 */
typedef mco_coro* context_t;

/**
 * context_desc - Coroutine description object.
 * As we are using minicoro library to handle coroutines, type is mco_desc
 */
typedef mco_desc context_desc;


/**
 * tb_task_f - Task function prototype.
 * @arg: Passed by coroutine library.
 * Task functions must have signature `void fn(context_t ctx)`. This typedef reflects
 * this signature when passing functions.
 */
typedef void (*tb_task_f)(context_t);


typedef enum
{
    TW_EVENT_INSTALL_SCHEDULE,
    TW_EVENT_RT_SCHEDULE,
    TW_EVENT_RT_CLOSE,
    TW_EVENT_SY_SCHEDULE,
    TW_EVENT_BEGIN_JSLEEP,
    TW_EVENT_REXEC_TIMEOUT
} twheel_event_t;

// default schedule cycle in microseconds - 1ms
#define TW_DEFAULT_SCHEDULE_LEN 5000


//////////////////////////////////////////////////////
/////////// TBoard Structure Definitions /////////////
//////////////////////////////////////////////////////

/**
 * function_t - Structure containing crucial function information
 * @fn:      function pointer
 * @fn_name: common function name
 *
 * This structure is essential for efficiently recording and serializing function
 * execution information in our history hash table. To pass a function to task_t,
 * instead of calling task_create(..., fn, ...) or setting task->fn = fn, one can
 * simply call task_create(..., TBOARD_FUNC(fn), ...) or set task->fn = TBOARD_FUNC(fn);
 */
typedef struct {
    const char *fn_name;
    tb_task_f fn;
    enum task_types_t tasktype;
    const char *fn_sig;
    int (*cond)(jcond_my_t, jcond_your_t);
    UT_hash_handle hh;
} function_t;

#define TBOARD_FUNC(name, func, sig, ccond, ttype) ((function_t){.fn = (func), .fn_name = (name), .fn_sig = (sig), .cond = (ccond), .tasktype = (ttype)})

struct history_t;
struct exec_t;


#define MAX_RT_SLOTS            8
#define MAX_SY_SLOTS            8

/**
 * sched_t - Data type for schedules
 * @len:        length of the schedule epoch in microseconds
 * @syslots:    SY task slots - could be 0
 * @systarts:   Starting times of each slot. We don't have end times because slot size is fixed
 * @rtslots:    RT task slots - could be 0
 * @rtstarts:   Starting times of each RT slot. The slot size is same across all slots. However, RT slots different from SY slots.
 */
typedef struct sched_t {
    int len;
    int syslots;
    int systarts[MAX_SY_SLOTS];
    int rtslots;
    int rtstarts[MAX_RT_SLOTS];
} sched_t;

/**
 * task_t - Data type containing task information
 * @id:         Task ID representing source of task
 * @status:     Status of current task
 *              @status == 0: task was issued
 *              @status == 1: task is running
 *              @status == 2: task has terminated
 * @type:       Task type.
 *              @type == PRIMARY_SY_EXEC: Highest priority primary task (synchronous)
 *              @type == PRIMARY_RT_EXEC: Second highest priority (real time task)
 *              @type == PRIMARY_BA_EXEC: Lowest priority task that goes in the primary executor
 *              @type == SECONDARY_BA_EXEC: Secondary executor tasks (only batch goes there)
 * @cpu_time:   CPU time of task execution
 * @yields:     Count of yields by task
 * @fn:         Task function to be run by task executor as function_t.
 *              This can be generated easily by macro TBOARD_FUNC(tb_task_f fn);
 * @ctx:        Task function context.
 * @desc:       Coroutine description structure.
 * @data_size:  Size of user_data passed to task_create(). If unallocated data is passed,
 *              this should be 0, meaning non-zero values are indictive of allocated user data
 * @hist:       Pointer to history_t object in hash table
 * @parent:     Link to parent task if task type is blocking (NULL value indicates non-blocking)
 *
 * Structure contains all necessary information relating to a task.
 *
 * Generation of this structure is done internally by task_create() functions and MQTT adapter
 */
typedef struct task_t {
    int id;
    int status;
    int type;
    int cpu_time;
    int yields;
    function_t fn;
    context_t ctx;
    context_desc desc;
    size_t data_size;
    void *cmd_obj;
    struct history_t *hist;
    struct task_t *parent;
} task_t;


typedef enum {
    TASK_MODE_REMOTE,
    TASK_MODE_REMOTE_NB,
    TASK_MODE_SLEEPING,
    TASK_MODE_DFLOW
} remote_task_mode_t;

/**
 * remote_task_t - Remote task type
 * @status:       status of remote task
 * @message:      remote task to send and execute
 * @data:         response from remote task and/or data passed to MQTT adapter
 * @data_size:    size of data/response. non-zero value indicative of alloc'd data
 * @calling_task: task_t pointer to task that issued remote task
 * @mode:     indicate the type of remote interaction the task would have.
  *
 * Any remote interface must be able to pull this from outgoing task queue and interpret it.
 * Once request has been fulfilled, it must be placed back into the incoming task queue
 *
 * If @blocking, then parent task will only be eligible for resuming once remote task response
 * is received. Otherwise, it will be placed back into the appropriate ready queue after task is
 * issued by MQTT adapter.
 */
typedef struct {
    int status;
    uint64_t task_id;
    char command[MAX_MSG_LENGTH];
    void *data;
    void *entry;
    size_t data_size;
    task_t *calling_task;
    remote_task_mode_t mode;
    int retries;
    int level;
    char fn_argsig[MAX_ARG_LENGTH];
    UT_hash_handle  hh;
} remote_task_t;

/**
 * tboard_t - Task Board object.
 * @primary:    Thread of primary task executor (pExecutor)
 * @secondary:  Threads of secondary task executors (sExecutor)
 * @pcond:      Condition variable of pExecutor
 * @scond:      Condition variables of sExecutor
 * @pmutex:     Mutex of pExecutor
 * @smutex:     Mutexs of sExecutor
 * @cmutex:     Task count mutex, locked when changing concurrent task count
 * @tmutex:     Task board mutex, locking only when significantly modifying tboard
 * @tcond:      Task board condition variable. This signals once all task executor threads
 *              have been joined in tboard_destroy()
 * @emutex:     Task board exit mutex, locking only when shutdown initializes.
 * @pqueue:     Primary task ready queue
 * @squeue:     Secondary task ready queues
 * @msg_mutex:  Message queue mutex, locking only when modifying message queues or using @msg_cond
 * @msg_cond:   Message queue condition variable, used for external MQTT adapter to sleep on
 * @sqs:        Number of secondary ready queues and executors
 * @task_count: Tracks the number of concurrent tasks running in task board
 * @exec_hist:  Task execution history hash table
 * @pexect:     pointer to pExecutor argument
 * @sexect:     pointer to sExecutor arguments
 * @status:     Task board status.
 *              @status == 0: Task Board has been created
 *              @status == 1: Task Board has started
 * @shutdown:   If not equal to 1, task board will initialize shutdown at next available cancellation point
 *
 * Task board object contains all relevant information of task board, which is passed between task board
 * functions. All task board functionality is dependant on this object. This object is created and
 * initialized in function tboard_create(). Task Board is started in tboard_start(). Task board object is
 * properly destroyed in tboard_destroy().
 *
 * Should a user wish to capture task board data after threads end via call to tboard_kill(), they must lock
 * @t->tmutex before calling tboard_kill(). One @t->tmutex has been unlocked after tboard_kill(), tboard_destroy()
 * will destroy the taskboard.
 */
typedef struct {

    pthread_t primary;
    pthread_t secondary[MAX_SECONDARIES];

    pthread_cond_t pcond;
    pthread_cond_t scond[MAX_SECONDARIES];

    pthread_mutex_t pmutex;
    pthread_mutex_t smutex[MAX_SECONDARIES];

    pthread_mutex_t iqmutex;
    pthread_mutex_t cmutex;

    pthread_mutex_t tmutex;
    pthread_cond_t tcond;

    pthread_mutex_t emutex;
    pthread_mutex_t hmutex;
    pthread_mutex_t twmutex;
    pthread_mutex_t schmutex;

    struct queue pqueue_sy;
    struct queue pqueue_rt;
    struct queue pqueue_ba;
    struct queue squeue[MAX_SECONDARIES];
    struct queue iq;

    int sqs;
    void *cnode;

    function_t *registry;

    int task_count;

    struct history_t *exec_hist;

    struct exec_t *pexect;
    struct exec_t *sexect[MAX_SECONDARIES];

    int shutdown; // should be set to 0 unless told to end after all tasks are completed
    int status;

    remote_task_t *task_table;
    struct timeouts *twheel;
    sched_t sched;
    sleeper_t sleeper;
    icache_t *icache;

} tboard_t;

/**
 * exec_t - Argument passed to task executor.
 * @type:   indicates whether task executor is primary or secondary.
 * @num:    If TExec is sExecutor, then @num identifies sExecutor.
 * @tboard: Reference to task board.
 *
 * This type is exclusively used by tboard_start(), where it is created, and by tboard_destroy() where
 * it is freed.
 *
 * Objects of this type are passed to executor() by tboard_start(), dictating executor() functionality.
 */
typedef struct exec_t { // passed to executor thread so it knows what to do
    int type;
    int num;
    tboard_t *tboard;
} exec_t;



///////////////////////////////////////////////
/////////// Scheduler Definitions /////////////
///////////////////////////////////////////////

/**
 * struct __schedule_t - Schedule type
 * @tboard: Reference to task board
 *
 * Currently unimplemented.
 */
typedef struct schedule_t{
    tboard_t *tboard;
} schedule_t;

///////////////////////////////////////////////
/////////// Sequencer Definitions /////////////
///////////////////////////////////////////////

void task_sequencer(tboard_t *tboard);
/** task_sequencer() - TSeq; Rearranges ready queues for priority task execution.
 * @tboard: pointer to taskboard object.
 *
 * Not fully implemented, the idea of this function is to resequence the ready queues
 * so that tasks with higher priorities and/or closer deadlines are executed in a
 * timely manner. We run this function in the executor before popping the head from
 * the respective ready queue.
 *
 * Under current implementation, it takes remote task responses from @t->msg_recv and places
 * then in the appropriate ready queue.
 *
 * It is at the discretion of the sequencer to determine if it has been run recently. it
 * is a good idea to resequence the queues when a new priority tasks are added.
 */

/////////////////////////////////////////////////
//////////// Executor Definitions ///////////////
/////////////////////////////////////////////////

void *executor(void *arg);
/**
 * executor() - Task Executor (TExec); Thread function that handles task execution.
 * @arg: pthread argument passed from pthread_create().
 *       this argument is a pointer to type exec_t.
 *
 * The task executor runs tasks from the respective ready queues. Based on the provided
 * argument, this function determines whether it is a primary or secondary executor thread.
 *
 * If primary executor (pExecutor), this is the "main thread" of the tBoard. This executor
 * handles the primary queues. Essential tasks (tasks that have dependancies/deadlines) are
 * run by this executor. If there are no tasks pending in the primary ready queue, or if
 * there are tasks before earliest start time (EST), then pExecutor may run tasks from a
 * secondary ready queue, returning them to their original queue on task_yield(). Should
 * pExecutor not find a task to run, it will sleep on the primary condition variable
 * tBoard->pCond (no_work).
 *
 * If secondary executor (sExecutor), then tasks will be pulled only from respective
 * secondary ready queue. If there are no tasks in queue, sExecutor will sleep on
 * respective condition variable tBoard->sCond[i].
 *
 * Pulling tasks from ready queues has two phases:
 * * spin-block phase: (not implemented)
 * * *    to save overhead from frequent sleeping/waking on condition variables, executor
 * * *    will poll the ready queue for a preset number of iterations before entering the
 * * *    sleep-wake phase. Number of iterations is defined in SPIN_BLOCK_ITERATIONS macro.
 *
 * * sleep-wake phase:
 * * *    after spin-block phase, executor will sleep on condition variable defined above.
 * * *    Condition variable will signal when a task is added into respective ready queue.
 *
 * Task executors will run as described indefinitely until task board is instructed to
 * terminate via special function tboard_kill().
 *
 * Context: Function will run in it's own thread, created in tboard_start().
 * Context: Function will sleep on condition variables described above
 * Context: Function will lock mutexes corresponding to tboard queues that it accesses
 * Context: Function will call history.c functions, locking tboard->hmutex
 */




//////////////////////////////////////////////////
///////////// TBoard Definitions /////////////////
//////////////////////////////////////////////////

tboard_t* tboard_create(void *cnode, int secondary_queues);
/**
 * tboard_create() - Creates task board object.
 * @secondary_queues: Number of secondary queues tboard should have.
 *
 * This function allocates and initializes task board object.
 *
 * Primary and secondary ready queues and wait queues are created and initialized.
 * Primary and secondary mutex and condition variables are initialized. tboard->status
 * will be set to 0, indicating that task board was created but has not started yet.
 *
 * Context: Free allocated memory associated with task board object is freed in tboard_destroy()
 *
 * Return: tboard_t type pointer refering to allocated task board object is returned.
 */

void tboard_start(tboard_t *tboard);
/**
 * tboard_start() - Starts task board.
 * @tboard: tboard_t pointer of task board to start
 *
 * This function will create task executor threads (pExecutor and sExecutor). Thread references
 * are stored on pthread_t variables tboard->primary and tboard->secondary[]. It will allocate
 * exec_t arguments passed to executor() to indicate executor type. Pointer to allocated memory
 * is stored in respective exec_t pointer of tboard object (pexect and sexect for pExecutor and
 * sExecutor respectively).
 *
 * Context: Creates threads referenced in @tboard.
 */

void tboard_shutdown(tboard_t *t);
/**
 * tboard_shutdown() - blocks until tboard terminates and at termination does a whole lot of data structure destroying
 * @t: tboard_t pointer of task board to shutdown
 *
 * This function joins task board executor threads. When threads terminate, the following occurs
 * * - Locks exit mutex @t->emutex, signals @t->tcond so tboard_kill() can return
 * * - Locks @t->tmutex in order to destroy all task board objects. This will be locked
 * *   if the user wishes to processes task board data before destroying
 * * - All task board mutexes and condition variables are destroyed
 * * - All ready queues are emptied and task data is freed
 * * - All message queues are emptied and task+msg data is freed
 * * - Task history hash table is destroyed
 * * - Task board object is freed
 *
 * Context: Function will block thread it is called on until task board threads are terminated
 *          via tboard_kill().
 * Context: After all executor threads end, @t->emutex locks to signal @t->tcond, allowing
 *          tboard_kill() to proceed
 * Context: Once @t->tmutex lock is granted, task board will be destroyed.
 * Context: Broadcasts @t->msg_cond incase any external MQTT adapters are waiting on variable
 *          so they can terminate gracefully.
 */

void tboard_exit();
/**
 * tboard_exit() - Terminates program
 *
 * This function calls pthread_exit(). This should be run only after tboard_destroy() at the end
 * of program main().
 *
 * Context: User is expected to run tboard_destroy() before tboard_exit().
 * Context: This function will terminate program.
 */

bool tboard_kill(tboard_t *t);
/**
 * tboard_kill() - Kill task board threads.
 * @t: tboard_t pointer of task board to kill.
 *
 * Terminates task board executor threads via pthread_cancel(). This will unblock
 * tboard_destroy() allowing program to terminate.
 *
 * Context: Executor threads stored in @t->primary and @t->secondary[] are canceled.
 *          As such, all @t->pmutex and @t->smutex[] are locked to signal @t->pcond
 *          and @t->scond[] respectively.
 * Context: Sleeps on @t->tcond, signal occurs once all tasks are joined.
 * Context: @t->emutex is locked to initiate shutdown, effectively blocking tboard_destroy()
 *          from proceeding until after all tasks are joined. Once that occurs, it will signal
 *          @t->tcond and tboard_kill() will end.
 *
 * Return:
 * * true   - task board was killed sucessfully.
 * * false  - task board was not killed, indicating @t is NULL or @t has not begun.
 *
 * Best practice is to lock @t->tmutex before calling this function, otherwise all
 * task board data will be destroyed. To capture task data, run functions after
 * tboard_kill() call but before unlocking @t->tmutex
 */



int tboard_get_concurrent(tboard_t *t);
/**
 * tboard_get_concurrent() - Returns number of concurrently running tasks
 * @t:  tboard_t pointer of task board.
 *
 * returns number of currently running tasks in taskboard, in all queues/executors.
 * this number will always be less than or equal to MAX_TASKS macro.
 *
 * Context: locks mutex @t->tmutex to access @t->task_count
 *
 * Return: @t->task_count
 */

void tboard_inc_concurrent(tboard_t *t);
/**
 * tboard_inc_concurrent() - Increments number of concurrently running tasks
 * @t:  tboard_t pointer of task board.
 *
 * Increments the number of concurrently running tasks in task board. This function performs no
 * checks whether or not MAX_TASKS has been exceeded. This should only be run when adding a new task
 * to any executor ready queue, in order to keep track of the number of unique tasks in all queues.
 *
 * Context: locks mutex @t->tmutex to access @t->task_count, and increments it
 */

void tboard_deinc_concurrent(tboard_t *t);
/**
 * tboard_deinc_concurrent() - Deincrements number of concurrently running tasks
 * @t:  tboard_t pointer of task board.
 *
 * Deincrements the number of concurrently running tasks in task board. This function performs no
 * checks whether or not current value is zero. This should only be run when adding any task completes
 * in any executor to indicate that a unique task is being removed from the ready task queue pool.
 *
 * Context: locks mutex @t->tmutex to access @t->task_count, and increments it
 */


int tboard_add_concurrent(tboard_t *t);
/**
 * tboard_add_concurrent() - Increments number of concurrently running tasks iff current
 *                           value is less than MAX_TASKS
 * @t:  tboard_t pointer of task board.
 *
 * This function essentially combines tboard_get_concurrent() and tboard_inc_concurrent. It will
 * check the current value of @t->task_count, and increment it if possible. This function assumes
 * that the value of task_count is not less than zero. If DEBUG is defined, it will perform this check
 * but will proceed anyways, logging any invalid values. It will return the new number of concurrently
 * running tasks, 0 on error.
 *
 * Context: locks mutex @t->tmutex to access @t->task_count
 *
 * Return: 0    - On Error: Unable to increment, as incrementing would exceed MAX_TASKS
 *         else - @t->task_count after incrementing
 */

void tboard_register_func(tboard_t *t, function_t fn);
function_t *tboard_find_func(tboard_t *t, char *fname);

////////////////////////////////////////////////
////////////// Task Functions //////////////////
////////////////////////////////////////////////

void remote_task_free(tboard_t *t, uint64_t taskid);
void remote_task_place(tboard_t *t, remote_task_t *rtask);
/**
 * remote_task_place() - Places remote task into appropriate queue
 * @t:      tboard_t pointer of task board.
 * @rtask:  remote_task_t pointer of remote task.
 * @send:   boolean value indicating whether remote task is being sent or received.
 *
 * Places remote task into appropriate queue in task board @t.
 *
 * Context: locks @t->msg_mutex
 */

arg_t *remote_task_create(tboard_t *tboard, char *cmd_func, int level, char *fn_argsig, arg_t *qargs, int nargs);
bool remote_task_create_nb(tboard_t *tboard, char *cmd_func, int level, char *fn_argsig, arg_t *qargs, int nargs);

bool sleep_task_create(tboard_t *tboard, int sval);

typedef struct {
    uint8_t* buf;
    uint32_t len;
} dflow_task_response_t;

dflow_task_response_t dflow_task_create(tboard_t *tboard, void *entry);

int preferred_task_level(remote_task_t *rt);

arg_t* blocking_task_create(tboard_t* t, function_t fn, int type, arg_t* retarg, arg_t* args, size_t sizeof_args);
/**
 * blocking_task_create() - Called from parent task, function creates blocking child task
 *                          and yields parent coroutine
 *
 * @t:           tboard_t pointer of task board.
 * @fn:          Task function with signature `void fn(void *)` as function_t to be executed.
 * @type:        Task type. Value is PRIMARY_EXEC or SECONDARY_EXEC.
 * @args:        Task arguments made available to task function @fn.
 * @sizeof_args: Size of task arguments passed. Should be non-zero only if @args points to
 *               alloc'd memory.
 *
 * Important notes: Function must be called from within a task board task, otherwise it will return
 * false.
 *
 * Important notes: @fn should not free passed `void *` argument, nor should it modify any pthread
 * cancellation policy. This is crucial!
 *
 * Child tasks created by this function will take the place of the parent/calling task in the
 * execution pool. Once the child task terminates, parent/calling task will be returned to its place
 * in the execution pool. For all intents, creating a blocking child task does not increase the number
 * of concurrent tasks running under the task board.
 *
 * Should a parent task wish to issue a child task and obtain a return value, then the parent task must
 * provide @args that the child task will modify. Provided that @sizeof_args == 0, @args will persist after
 * child task has terminated. Modifications to @args would then be the return value that the parent can access
 * once parent task has resumed.
 *
 * Context: Parent task will yield execution back to executor
 *
 * Return: value* (in arg_t format)  - Child task has been executed and terminated successfully
 *         NULL - Child task could not be executed
 *               - Function was not called from a task, meaning no child task could be created
 *
 * Function will only return once parent task has been resumed by executor after child task was issued.
 */

bool task_create(tboard_t *t, function_t fn, void *args, void *cmd);
/**
 * task_create() - Creates task, adds to appropriate ready queue to be executed
 *                 by task executor.
 * @t:           tboard_t pointer of task board.
 * @fn:          Task function with signature `void fn(void *)` as function_t to be executed.
 * @args:        Task arguments made available to task function @fn.
 *
 * Important notes: @fn should not free passed `void *` argument, nor should it modify any pthread
 * cancellation policy. This is crucial!
 *
 * Creates task to be run by task board and adds it to respective ready queue, dependent on
 * task type @type. Should a task have side effects, @type is expected to reflect this. Once added
 * to a ready queue, it will signal condition variable of relevant executor to indicate that a new task
 * has been added to the ready queue.
 *
 * Task functions return on task completion. Data can be made available to task function by setting
 * @args argument to data pointer. Although tasks cannot return data, modifications to @args by task
 * function will persist after execution. It is the user's responsibility to handle task allocation of
 * task data.
 *
 * Should a task issue I/O requests or be required to wait for an event, it is expected to call
 * task_yield() to be non-blocking. When task yields, it will be added back to the ready queue. It is
 * the user's prerogative to create tasks that are non-blocking and efficient. Task execution will occur
 * until task function yields or terminates. Poorly construction functions will prevent multi-tasking.
 *
 * Tasks can be executed for a finite amount of time, or iterations can run indefinitely. For the latter,
 * tasks will typically be run in an infinite loop and are expected to yield after every iteration, otherwise
 * the single task will run the entire time, blocking other tasks from executing.
 *
 * Tasks created via task_create() are local tasks. Remote procedure tasks (RPC) can be issued by MQTT
 * and are sent in the form of a message, handled by msg_processor().
 *
 * Context: Process context. Takes and releases task executor mutex (@t->pmutex, @t->smutex[] for
 *          pExecutor and sExecutor)
 * Context: Process Context. Signal task executor condition variable (@t->pcond, @t->scond[] for
 *          pExecutor and sExecutor)
 *
 * Return:
 * * true   - task was added to task board successfully.
 * * false  - task was not added to task board.
 */

void task_place(tboard_t *t, task_t *task);
/**
 * task_place() - Places task into ready queue
 * @t:    tboard_t pointer to task board.
 * @task: task_t pointer to task
 *
 * Function takes initialized task and places it into appropriate ready queue. It is assumed that
 * the task is ready for adding, meaning that it is initialized and it's context is created. This
 * should only be used internally by task board to place a task in its appropriate ready queue.
 *
 * Context: Locks mutex of appropriate ready queue before placing it
 */

bool task_add(tboard_t *t, task_t *task);
/**
 * task_add() - Adds task to task board.
 * @t:    tboard_t pointer to task board.
 * @task: task_t pointer to task
 *
 * Adds task to task board. This function is called internally by task_create() and other functions
 * that create tasks. Local tasks should be added by task_create() call.
 *
 * It is assumped that task_t pointers to a properly formatted task object.
 *
 * Function determines which TExec ready queue task should be added to. It will lock the appropriate
 * TExec mutex and signal condition variable after adding to ready queue.
 *
 * Context: Process context. Takes and releases task executor mutex (@t->pmutex, @t->smutex[] for
 *          pExecutor and sExecutor)
 * Context: Process Context. Signal task executor condition variable (@t->pcond, @t->scond[] for
 *          pExecutor and sExecutor)
 *
 * Return:
 * * true   - task was added to task board successfully.
 * * false  - task was not added to task board.
 */

void task_yield();
/**
 * task_yield() - yields currently run task
 *
 * This should only be called by task function. Otherwise functionality is undefined.
 *
 * When it is called, context will be returned to task executor in an executor thread, and task
 * will be added to the back of the appropriate ready queue.
 */

void *task_get_args();
/**
 * task_get_args() - Gets @args passed to task_create on task creation
 *
 * This function returns @args defined on task creation, which are arguments that are meant to be
 * made available to the running task. Using the minicoro library, we simply request user data for
 * the currently running coroutine via minicoro api call.
 *
 * Return: Function arguments issued on task creation, as a void pointer.
 */

void remote_task_destroy(remote_task_t *rtask);
/**
 * remote_task_destroy() - Destroy remote task on tboard destroy
 * @rtask: Pointer to remote task to destroy
 *
 * Destroys remote task and any associated local tasks on task board destroy
 */

void task_destroy(task_t *task);
/**
 * task_destroy() - Destroy tasks on completion
 * @task: task_t reference of task to destroy
 *
 * Properly destroys task once completed. If parent task exists, task_destroy()
 * recursively will destroy parent first and then afterwards destroy supplied task.
 *
 * Task destroys task function context, and then frees task arguments if indicated as allocated
 */



//////////////////////////////////////////////////
////////////// Processor Definitions /////////////
//////////////////////////////////////////////////


void msg_processor(void *serv, command_t *cmd);
/**
 * msg_processor() - Handles message issued remotely by MQTT
 * @serv:   server_t pointer to server interface
 * @cmd: command to be processed.
 *
 * This function should only be called by MQTT Adapter. MQTT Adapter is expected to handle memory
 * associated with @msg and to properly format @msg.
 *
 * msg_processor() will add either add a task to task board, or will modify schedule
 *
 * Currently, only adding controller-to-worker task to task board is implemented
 *
 * Context: Locks appropriate task ready queue mutex in task_add() call.
 *
 * Return: true  - message was process successfully and placed appropriately
 *         false - message could not be placed appropriately
 *
 * Currently, msg_processor() returning false means that task could not be added. This occurs
 * when adding the task would exceed allowed number of concurrently running tasks, and should
 * indicate that @msg should be returned to the message queue.
 */

void send_close_msg(void *serv, char *node_id, uint64_t task_id);
void send_err_msg(void *serv, char *node_id, uint64_t task_id);
void send_ack_msg(void *serv, char *node_id, uint64_t task_id, int timeout);
void send_nak_msg(void *serv, char *node_id, uint64_t task_id);
void send_reg_msg(void *serv, char *node_id, uint64_t task_id);

////////////////////////////////////////////////////////////////
/////////////////// Task history functionality /////////////////
////////////////////////////////////////////////////////////////

/**
 * history_t - tracks task execution history
 * @fn_name:     task function name (also hash table key, must be unique)
 * @mean_t:      average run time in CPU time units for complete executions
 * @mean_yield:  average number of yields for all complete executions
 * @yields:      total number of yields for all executions (incremented at each yield)
 * @executions:  number of exections
 * @completions: number of complete executions
 *
 * This type is handled internally by history.c implementation. A pointer must be present in
 * tboard_t task board object to serve as the head of the hash table. Pointers present in
 * task_t task object are references to single entry in hash table, so modifications can be
 * made freely to history_t entry without searching the list.
 */

typedef struct history_t {
    char *fn_name;
    double mean_t;
    double mean_yield;
    double yields;
    int executions;
    int completions;
    UT_hash_handle hh;
} history_t;


void history_record_exec(tboard_t *t, task_t *task, history_t **hist);
/**
 * history_record_exec() - Record task execution in history hash table
 * @t:    tboard_t pointer to task board
 * @task: task_t pointer of task to record
 * @hist: history_t in hash table to return
 *
 * This function will record execution information to the history_t hash table
 * of the task board @t. If there is currently no record in the hash table,
 * history_record_exec() will add it to the table, attaching entry to @hist. If
 * record does exist, @hist will reflect its location and its data will be modified.
 *
 * @hist is expected to point to a null pointer.
 *
 * Context: locks @t->hmutex in order to modify hash table
 */

void history_fetch_exec(tboard_t *t, function_t *func, history_t **hist);
/**
 * history_fetch_exec() - Fetch history hash table entry corresponding to function_t @func.
 * @t:    tboard_t pointer to task board
 * @func: function_t pointer of function to fetch
 * @hist: history_t in hash table to return
 *
 * This function will fetch execution information from the history_t hash table
 * of the task board @t. If there is currently no record in the hash table,
 * @hist will point to NULL pointer. If record does exist, @hist will reflect it's
 * location and its data will be modified.
 *
 * @hist will be rewritten.
 *
 * Context: locks @t->hmutex in order to modify hash table
 */

void history_destroy(tboard_t *t);
/**
 * history_destroy() - Destroys history hash table
 * @t:    tboard_t pointer to task board
 *
 * Function should only be called in tboard_destroy(). This function will iterate through
 * hash table, freeing every entry. Should the user wish to serialize the hash table, they must
 * do so before this function is called in tboard_destroy(). See tboard_kill() for more
 * information on locking task board destruction at shutdown.
 *
 * Context: locks @t->hmutex in order to destroy hash table
 */

void history_save_to_disk(tboard_t *t, FILE *fptr);
/**
 * history_save_to_disk() - Saves task board history to disk
 *
 * TODO: implement
 *
 */

void history_load_from_disk(tboard_t *t, FILE *fptr);
/**
 * history_load_from_disk() - Loads task board history from disk
 *
 * TODO: implement
 */

void history_print_records(tboard_t *t, FILE *fptr);
/**
 * history_print_records() - Prints execution history to @fptr
 * @t:    tboard_t pointer to task board
 * @fptr: file pointer to print records to.
 *
 * @fptr is assumed opened, and is assumed to be closed. Default value should be stdout.
 * format will print as:
 *
 * "task 'func_name' completed %d/%d times, yielding %f times with mean execution time %f"\
 *
 * Context: locks @t->hmutex in order to access hash table
 */

void destroy_func_registry(tboard_t *t);



////////////////////////////////////////////////////////////////
/////////////////////// Timing Wheel Utils //////////////////
////////////////////////////////////////////////////////////////

timeout_t getcurtime();
struct timeouts *twheel_init();
struct timeout *twheel_get_next(tboard_t *tb);
void *clone_taskid(uint64_t *task_id);
bool twheel_add_event(tboard_t *tb, twheel_event_t type, void *arg, timeout_t tval);
bool twheel_delete_timeout(tboard_t *tb, uint64_t *id);
void twheel_update_to_now(tboard_t *tb);
timeout_t twheel_get_sleep_duration(tboard_t* tb, timeout_t max_sleep);


////////////////////////////////////////////////////////////////
/////////////////////// Executor Utils //////////////////
////////////////////////////////////////////////////////////////

void dummy_next_schedule(void *arg);
void dummy_next_sy_slot(void *arg);
void dummy_next_rt_slot(void *arg);
void dummy_close_rt_slot(void *arg);
void dummy_next_sleep_event(void *arg);
void dummy_next_timeout_event(void *arg);

void install_next_schedule(tboard_t *tb, timeout_t etime);
void wait_to_sy_slot(tboard_t *tb, void *arg, timeout_t stime);
void process_sleep_event(tboard_t *t, void *arg);
void process_timeout_event(tboard_t *t, void *arg);


////////////////////////////////////////////////////////////////
/////////////////////// Logging functionality //////////////////
////////////////////////////////////////////////////////////////

int tboard_log(char *format, ...);
/**
 * tboard_log() - Log string to stdout.
 * @format: format of log string.
 * @...:    list of arguments corresponding to provided format.
 *
 * identical syntax to functions we love like printf
 */
int tboard_err(char *format, ...);
/**
 * tboard_log() - Report string to stderr.
 * @format: format of error string.
 * @...:    list of arguments corresponding to provided format.
 *
 * identical syntax to functions we love like printf
 */




#endif
