#include <stdio.h>


jsync int hello(char *s)
{
    printf("Printing from hello function..%s returning the length of string..\n", s);
    return strlen(s) * strlen(s);

}


int main()
{
    printf("In the main...\n");
    return 0;
}
