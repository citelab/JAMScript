
#include <stdio.h>
#include <jam.h>
#include <unistd.h>

extern cnode_t *cn;

void local_test3(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 5000000; i++) {
        task_yield();
    }
    exit(0);
}


void calllocal_test3(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test3(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
}


/*
 * The purpose of this test is to check how long it takes to switch tasks. Here we use a single task and just yield.
 * We can have multiple tasks that are switching among them as well. 
 * NOTE: We measured it on a MacBook with i9 and it does the task switching in about 800 ns.
 */

int main(int argc, char *argv[]) 
{
    cn = cnode_init(argc, argv);

    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test3, "sss", PRI_BATCH_TASK));
    local_async_call(cn->tboard, "calllocal_test3", "mahesh", "hello!", "world");
    cnode_stop(cn);
    cnode_destroy(cn);
}

