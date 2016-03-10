#include "timer.h"

#include <stdio.h>
#include <stdbool.h>
#include <stdlib.h>
#include <unistd.h>


timertype_t *tmr;

void hello(void *arg)
{
    char *s = (char *)arg;
    printf("Hello was called... with %s\n", s);

}


void world(void *arg)
{
    char *s = (char *)arg;
    printf("World was called... with %s\n", s);
}


void delete(void *arg)
{
    char *s = (char *)arg;
    printf("======= Deleting.. %s===========================\n", s);
    timer_del_event(tmr, s);
}




int main(void)
{
    tmr = timer_init();


    timer_add_event(tmr, 100, true, "hello", hello, "100");
    timer_add_event(tmr, 500, false, "hello", hello, "500");

    timer_add_event(tmr, 2000, true, "delete", delete, "world");
    timer_add_event(tmr, 300, true, "world", world, "what is up?");



    sleep(10);
}
