
jtask* local_noargs() 
{
    printf("Run from inside a jtask.\n");
}

int main(int argc, char *argv[])
{
    local_noargs();
    
    return 0;
}
