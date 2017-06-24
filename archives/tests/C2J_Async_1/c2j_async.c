#include <stdio.h>

void doubler(int);

int main() 
{
    int i;
    for (i = 0; i < 200; i++) 
    {
        printf("Calling doubler..\n");
	    doubler(i);

    }
    return 0;
}
