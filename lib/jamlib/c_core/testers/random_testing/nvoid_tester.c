#include "nvoid.h"

#include <stdio.h>
#include <string.h>


int main(void)
{
    char *str = "hello, world.. how are you doing?";

    nvoid_t *n = nvoid_new((void *)str, strlen(str));

    nvoid_print_ascii(n);

    char  *a = " I am doing fine.";
    n = nvoid_append(n, a, strlen(a));

    nvoid_print_ascii(n);

    char *s = " maheswaran ";

    nvoid_t *q = nvoid_new((void *)s, strlen(s));

    nvoid_print_ascii(q);

    nvoid_t *b = nvoid_concat(n, q);

    nvoid_print_ascii(b);

}
