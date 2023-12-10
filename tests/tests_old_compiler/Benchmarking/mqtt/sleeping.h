#ifndef __SLEEPING_H__
#define __SLEEPING_H__

#include <math.h>
#include <time.h>
#include <stdlib.h>
#include <stdio.h>

typedef struct sleeper {
    // there can be other parameters over here.
    double savg;
} sleeper_t;

// 500 microseconds or smaller is considered SHORT sleeping
#define SHORT_SLEEP_TIME            500000

static inline int64_t curtime_in_nanosec()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (int64_t)(1000000000 * ts.tv_sec + ts.tv_nsec);
}

static inline void __do_sleep() 
{
    // we could do other sleeps as well
    asm("nop");asm("nop");asm("nop");asm("nop");
    asm("nop");asm("nop");asm("nop");asm("nop");
    asm("nop");asm("nop");asm("nop");asm("nop");
}

/**
 * @brief Busy sleep for the given time (in nanoseconds). This is a precise sleeper. 
 * It uses a learned sleeper that gives the number of asm("nop") instructions to use.
 * 
 * @param sleep_factor 
 * @param stime  - sleeping time in nanoseconds
 */
static inline void tiny_busy_sleep(sleeper_t *s, int64_t stime) 
{
    int64_t start = curtime_in_nanosec();
    for (int i = 0; i < lround(stime/s->savg); i++)
        __do_sleep();
    int64_t end = curtime_in_nanosec();
    // do the correction
    double x = (end - start)/stime;
    s->savg = s->savg * 0.8 +  (11.0 * x/(10.0 * x + 1)) * s->savg * 0.2;
}


/**
 * @brief Block sleep for the given time (in nanoseconds). This is NOT a precise sleeper.
 * You don't need to learn the sleeping scale to use this sleeping mechanism. 
 * We use the nanosleep provided by the OS, expect a lot of jitter. 
  * 
 * @param stime  - sleeping time in nanoseconds
 */
static inline void small_block_sleep(sleeper_t *s, int64_t stime) 
{
    int64_t start = curtime_in_nanosec();
    struct timespec ts = {.tv_sec = 0.9 * stime/1000000000, .tv_nsec = lround(0.9 * stime) % 1000000000}, tr;
    nanosleep(&ts, &tr);
    int64_t end = curtime_in_nanosec();
    if ((end - start) < stime) 
        tiny_busy_sleep(s, stime - (end - start));
}

/**
 * @brief This is a smart sleeper that uses system sleeping and busy sleeping to get accurate sleeping
 * 
 * @param s  - sleeper object
 * @param stime -sleeping time in nanoseconds
 */
static inline void smart_sleep(sleeper_t *s, int64_t stime) 
{
    if (stime < SHORT_SLEEP_TIME)
        tiny_busy_sleep(s, stime);
    else 
        small_block_sleep(s, stime);
}

static inline void sleep_until(sleeper_t *s, int64_t stime, double frac) 
{
    int64_t ctime = curtime_in_nanosec();
    smart_sleep(s, lround((stime - ctime) * 0.8));
}

static inline void system_sleep(int64_t stime) 
{
    struct timespec ts = {.tv_sec = stime/1000000000, .tv_nsec = stime % 1000000000}, tr;
    nanosleep(&ts, &tr);
}

/**
 * @brief Learn the sleep_factor. This is the time for a single sleep statement in nanoseconds.
 * You call the learn_sleeping with a set trial number
 * 
 * @param sleep_f 
 * @param n 
 */
static inline void learn_sleeping(sleeper_t *s, int n) 
{
    int64_t start, end;
    s->savg = 0;

    // setup initial value
    start = curtime_in_nanosec();
    for (int i = 0; i < n; i++)
        __do_sleep();
    end = curtime_in_nanosec();
    s->savg = ((double)(end - start)/n);

    // refine the value..
    for (int i = 0; i < 100; i++) {
        start = curtime_in_nanosec();
        tiny_busy_sleep(s, 2000);
        end = curtime_in_nanosec();
        s->savg = s->savg * 0.8 +  ((end - start)/2000.0) * s->savg * 0.2;
    }
}

#endif
