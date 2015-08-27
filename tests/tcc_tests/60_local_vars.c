#include <stdio.h>


int j;

void foo()
{
    int i;
    float j[10];
    printf("foo: first for\n");

    for (i = 0; i < 3; i++)
    {
        int j = i+1;
        printf("foo: %d\n", i);
    }
    
    while(1)
    {
        int i = 5;
        printf("foo: while: %d\n", i);
        if (1) break;
    }

    printf("foo: second for\n");

    for (i = 0; i < 3; i++)
    {
        printf("foo: %d\n", i);
    }

    for (i = 0; i < 100000; i++)
    {
        {
            int j = i + 1; /* will be caught by VariableDefineButIgnoreIdentical */
        }
    }

    for (i = 0; i < 3; i++)
    {
        {
            int j = i;
            printf("foo: %d\n", j);
        }
    }
    
    
}



int main(){
    int i;
    printf("first for\n");

    for (i = 0; i < 3; i++)
    {
        int j = i+1;
        printf("%d\n", i);
    }

    printf("second for\n");

    for (i = 0; i < 3; i++)
    {
        printf("%d\n", i);
    }
    foo();
    return 0;
}
