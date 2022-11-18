#include <stdio.h>
#include "jam.h"
#include <unistd.h>

extern cnode_t *cn;

void local_test(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 2; i++) {
        sleep(1);
     //   printf("This is local test.. %s\n", name);
    //    printf("This is local test.. %s\n", g);
     //   printf("This is local test.. %d %s\n", i, h);
    //    task_yield();
        a = remote_sync_call(cn->tboard, "testrv", "id", 121, 34.32);
        //command_arg_free(a);
        task_yield();
 //       remote_sync_call(cs->tboard, "addfloat", "", 0, "ff", 45.0, 545.03434);
        command_arg_print(a);
    }
}


void local_test3(char *name, char *g, char *h)
{    
    arg_t *a;
    for (int i =0; i < 1000000; i++) {
     //   printf("This is local test.. %s\n", name);
    //    printf("This is local test.. %s\n", g);
     //   printf("This is local test.. %d %s\n", i, h);
    //    task_yield();
        a = remote_sync_call(cn->tboard, "testfunc", "", 0, "ssi", "this is test 2 - hello", "world", i);
        command_args_free(a);
        task_yield();
 //       remote_sync_call(cs->tboard, "addfloat", "", 0, "ff", 45.0, 545.03434);
//        command_arg_print(a);
    }
}


void local_test2(char *name, int k, double q)
{
    //arg_t *q2;
    printf("This is local test.. %s\n", name);
    printf("This is local test.. %d\n", k);
    printf("This is local test.. %f\n", q);
    task_yield();
/*
    for (int i = 0; i < 10; i++)
    {
        q2 = local_sync_call(cn->tboard, "callgive_value", "nagesh");
        printf("%d After . calling sync  %s\n", i, q2->val.sval);
        command_arg_free(q2);
        task_yield();
    }
    */
}


void calllocal_test2(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test2(t[0].val.sval, t[1].val.ival, t[2].val.dval);
 //   command_arg_free(t);
}

void *calllocal_test3(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test3(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
    return NULL;
}

void calllocal_test(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    local_test(t[0].val.sval, t[1].val.sval, t[2].val.sval);
    command_args_free(t);
}

char *give_value(char *str)
{
    return str;
}

void callgive_value(context_t ctx)
{
    (void)ctx;
    arg_t *t = (arg_t *)(task_get_args());
    arg_t retarg; // = calloc(1, sizeof(arg_t));
    retarg.type = STRING_TYPE;
    //retarg.type = INT_TYPE;
    retarg.nargs = 1;

    retarg.val.sval = strdup(give_value(t->val.sval));
    //retarg.val.ival = 324321212;

    mco_push(mco_running(), &retarg, sizeof(arg_t));
    command_arg_inner_free(t);
}


int main(int argc, char *argv[]) 
{
    cn = cnode_init(argc, argv);

    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test, "sss", false));
    tboard_register_func(cn->tboard, TBOARD_FUNC(calllocal_test2, "sid", false));
    tboard_register_func(cn->tboard, TBOARD_FUNC(callgive_value, "s", false));

    local_async_call(cn->tboard, "calllocal_test", "mahesh", "world", "argh", "dfsdfsd");
    cnode_stop(cn);
    cnode_destroy(cn);
}

