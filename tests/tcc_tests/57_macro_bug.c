#include "stdio.h"

#define MIN(a,b) ((a) < (b) ? (a) : (b))

int main()
{
    float x = MIN(1,2);
    int y = 14;
    float z;
    float pi = 3.14;
    int pi_int = pi;

    z = MIN(y, 13.5);
    y = MIN(y, 13);
    
    printf("Macro test: %d %d %f %d \n", (int)x, y, z, pi_int);
    return 0;
}
