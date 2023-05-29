//#include <stdio.h>

jtask* local_noargs()
{
    printf("local_noargs has been run.\n");
}


jtask* local_input(int special_number)
{
    printf("The Special Number: %d\n", special_number);
}


jtask int local_ret()
{
    return 1337;
}

jtask* test_func()
{
    printf("Called from command. NO_ARGS\n");
}

jtask* test_func2(int crazy_number)
{
    printf("Called from command. ARG: %d\n", crazy_number);
}

int main()
{
    printf("Starting local call test.\n");
    
    local_noargs();

    local_sync_call(cnode->tboard, "local_noargs");
    local_sync_call(cnode->tboard, "local_ret");
    local_async_call(cnode->tboard, "local_noargs");
    local_async_call(cnode->tboard, "local_input", 1337);

    //multicast_test();

    return 0;
}