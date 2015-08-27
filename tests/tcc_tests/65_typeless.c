#include "stdio.h"

int main()
{
    int i;
    float x = 3.9;
    int y = 4;
    int* z = &y;
    char* msg = "hi there";
    printf("%d %d %d %s\n", (int)(x*2), y*2, *z, msg);
    printf("%lu %lu %lu\n", sizeof(x), sizeof(y), sizeof(msg));
    for (i = 1; i <= 3; i++)
        printf("%d\n", i);

    /* this should fail
    { 
        int q = 5;
    }
    q = 3.14; // should say error
    */
    return 0;
}
