void simple_function(char* b, char* c);

jtask* local_noargs() 
{
    printf("Run from inside a jtask.\n");
}

int main(int argc, char *argv[])
{
    local_noargs();
    
    simple_function("b", "Test string. That is a lot larger.");
    
    return 0;
}
