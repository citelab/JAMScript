/*

The MIT License (MIT)
Copyright (c) 2016 Muthucumaru Maheswaran

*/

#ifndef __JAM_RUNNER_H__
#define __JAM_RUNNER_H__


#define MAX_TASKS               64


typedef void (*taskcallback_f)(void *ten, void *arg);

enum tasktype_t 
{
    SYNC_TASK,
    ASYNC_TASK
};

enum taskstate_t
{
    TASK_NEW,
    TASK_RUNNING,
    TASK_FINISHED
};


typedef struct _taskentry_t
{
    enum tasktype_t type;
    char *name;
    char *signature;
    taskcallback_f cback;
    enum taskstate_t state;
    
} taskentry_t;
    

typedef struct _tasktable_t
{
	int numtasks;
	taskentry_t *tasks[MAX_TASKS];
    
} tasktable_t;


void jrun_reg_task(tasktable_t *tt, char *name, int type, char *signature, taskcallback_f cback);
taskentry_t *jrun_find_task(tasktable_t *tt, char *name);
bool jrun_conform_task(taskentry_t *ten, void *arg);
void jrun_run_task(taskentry_t *ten, void *arg);
tasktable_t *jrun_init();


#endif


