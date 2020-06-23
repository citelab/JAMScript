#include <stdio.h>

int n = 0;

jsync int j2c_sync(char* id)
{
    printf("J2C sync called from fog %s\n", id);
    return n++;
}

int main(int argc, char* argv[])
{
    return 0;
}
