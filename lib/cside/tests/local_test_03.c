#include <stdio.h>
#include "jam.h"
#include <unistd.h>

extern cnode_t *cn;

void local_test(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 20; i++) {
        printf("This is local test.. %s -- %d \n", name, i);
        sleep_task_create(cn->tboard, 1500);
        task_yield();
    }
}

void local_test2(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 20; i++) {
        printf("============================= This is local test2 .. %s\n", name);
        sleep_task_create(cn->tboard, 500);
        task_yield();
    }
}

void calllocal_test(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
}

void calllocal_test2(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test2(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
}

int main(int argc, char *argv[]) 
{
    cn = cnode_init(argc, argv);

    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test, "sss", PRI_BATCH_TASK));
    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test2, "sss", PRI_BATCH_TASK));
    local_async_call(cn->tboard, "calllocal_test", "mahesh", "world", "argh");
    local_async_call(cn->tboard, "calllocal_test2", "mahesh", "world", "argh");
    cnode_stop(cn);
    cnode_destroy(cn);
}

