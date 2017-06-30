#include <stdio.h>

struct s1;

struct s2
{
    struct s1 *s;
};

struct s1
{
    struct s2 *s;
};

int main()
{
    printf("ok\n");
    return 0;
}
