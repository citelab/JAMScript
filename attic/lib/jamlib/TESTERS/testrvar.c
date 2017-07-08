#include <stdio.h>
#include <stdlib.h>
#include <string.h>


typedef struct _qq {
    int x;
    char *str;
} qq;

qq *retqq() 
{
    qq *x = (qq *) calloc(3, sizeof(qq));

    x[0].x = 10;
    x[0].str = strdup("hello - 0");

    // x[1].x = 20;
    // x[1].str = strdup("hello - 1");
    x[1] = NULL;

    x[2].x = 30;
    x[2].str = strdup("hello - 2");

    return x;
}


int main() 
{
    qq *u = retqq();

    for (int i = 0; i < 3; i++)
    {
        printf("X = %d\n", u[i].x);
        printf("Str = %s\n", u[i].str);
    }
}