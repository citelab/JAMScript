
#include <stdio.h>
#include <jam.h>
#include <unistd.h>

extern cnode_t *cn;

int count = 0;

void local_test3(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 2; i++) {
        printf("Hi\n");
        task_yield();
    }
}


void calllocal_test3(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test3(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
    count++;
    if (count == 500)
        exit(0);
}



int main(int argc, char *argv[]) 
{
    cn = cnode_init(argc, argv);

    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test3, "sss", PRI_BATCH_TASK));
    for (int i = 0; i < 1000; i++)
        local_async_call(cn->tboard, "calllocal_test3", "mahesh", "hello!", "world");
    cnode_stop(cn);
    cnode_destroy(cn);
}

