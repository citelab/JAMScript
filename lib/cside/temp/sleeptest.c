// comment

#include "src/sleeping.h"
#include <stdio.h>

int main() 
{
    struct sleeper_t s;
    int ftime, stime;
    learn_sleeping(&s);
    printf("A = %f, b %f\n", s.a, s.b);
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    ftime = ts.tv_sec * 1000000000 + ts.tv_nsec; 
    tiny_busy_sleep(&s, 10000);
    //struct timespec s2 = {.tv_nsec = 20000, .tv_sec = 0};
    //struct timespec q;
    //nanosleep(&s2, &q);
    clock_gettime(CLOCK_MONOTONIC, &ts);
    stime = ts.tv_sec * 1000000000 + ts.tv_nsec; 
    printf("Difference %ld\n", stime - ftime);
}