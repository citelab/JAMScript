/* credits: CSmith, a random generator of C programs. */

#include "stdio.h"

void func_1(void)
{
    int x = 5;
    int* px = &x;
    int** ppx = &px;
    int*** pppx = &ppx;
    int a = - - x;
    int b = - - - x;
    int c = -***pppx;
    int d = - -****&pppx;
    printf("a=%d\n", a);
    printf("b=%d\n", b);
    printf("c=%d\n", c);
    printf("d=%d\n", d);
}

int main()
{
    func_1();
    return 0;
}
