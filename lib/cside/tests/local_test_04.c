#include <stdio.h>
#include "jam.h"
#include <unistd.h>

extern cnode_t *cn;

void local_test(char *name, char *g, char *h)
{    
    printf("This is local test.. %s\n", name);
}


void calllocal_test(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
}

int main(int argc, char *argv[]) 
{
    cn = cnode_init(argc, argv);
    temp_schedule_inject(cn, 0);
    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test, "sss", PRI_REAL_TASK));

    for (int i = 0; i < 100; i++)    
        local_async_call(cn->tboard, "calllocal_test", "mahesh", "world", "argh");
    cnode_stop(cn);
    cnode_destroy(cn);
}

