#ifdef __APPLE__
#define _XOPEN_SOURCE
#endif

#include <ucontext.h>

#include <stdio.h>

void mm()
{
    while(1)
        printf("Hello\n");

}

ucontext_t q;
ucontext_t c;

int main(void)
{

    //ucontext_t *ctx = (ucontext_t *)calloc(1, sizeof(ucontext_t));

    getcontext(&c);

    c.uc_link            = NULL;
    c.uc_stack.ss_sp     = (void *)malloc(20000);
    c.uc_stack.ss_size   = 20000;
    c.uc_stack.ss_flags  = 0;
    makecontext(&c, &mm, 0);



    int i = 0;

    while (i++ < 50)
        printf("World %d\n", i);




//    context_save(&q);
    printf("Switch \n");
//    context_switch(&q, c);
    swapcontext(&q, &c);
}
