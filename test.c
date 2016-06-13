#include <stdio.h>

int main(void)
{
    int i, j;

    for (i = 0; i < 10; i++) {
        for (j = 0; j < 10; j++)
            if (i == 2 && j == 3)
                break;
        printf("Hello i = %d, j = %d \n", i, j);
    }

    printf("Hello i = %d, j = %d \n", i, j);            

}
