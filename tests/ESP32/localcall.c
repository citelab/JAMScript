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

int main()
{
    printf("Starting local call test.\n");
    
    local_noargs();

    local_sync_call(cnode->tboard, "local_noargs");
    local_sync_call(cnode->tboard, "local_ret");
    local_async_call(cnode->tboard, "local_noargs");
    local_async_call(cnode->tboard, "local_input", 1337);

    while(1){}

    return 0;
}