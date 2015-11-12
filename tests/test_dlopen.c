
/**
 * A simple test program for dlopen() and dlsym()
 */

#include <stdio.h>
#include <stdlib.h>
#include <dlfcn.h>


int main(int ac, char *av[])
{
    char *error;
    int (*hello)();

    void *p = dlopen("./libhello.so", RTLD_NOW|RTLD_GLOBAL);
    if (p == NULL) {
        fprintf(stderr, "%s\n", dlerror());
        exit(1);
    }

    printf("Opened the shared library..");

    // clear existing errors
    dlerror();

    printf("Finding the dynamic symbol..\n");
    *(void **) (&hello) = dlsym(p, "hello");

    printf("After finding...");
    if ((error = dlerror()) != NULL) {
        fprintf(stderr, "%s\n", dlerror());
        exit(1);
    }

    (*hello)();
}
