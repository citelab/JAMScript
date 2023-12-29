#ifndef __TPROFILER_H__
#define __TPROFILER_H__

// Profiler for performance mapping.
// We want to use this simple profiler determine the bottleneck portions of the code

#include <time.h>
#include <stdio.h>

uint64_t _getcurtime()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000000 +  ts.tv_nsec/1000;
}

// uncomment the line below to do snapshots
// #define     __INSERT_SNAPSHOT           1

#ifdef __INSERT_SNAPSHOT
#define DO_SNAPSHOT(X) do {                        \
            get_snapshot(X);                       \
    } while (0);

#define PRINT_SNAPSHOTS(X) do {                    \
            print_snapshot_summary(X);             \
    } while (0);
#else
    #define DO_SNAPSHOT(X)
    #define PRINT_SNAPSHOTS(X)
#endif

#define MAX_SNAPS               32
static uint64_t timesnaps[MAX_SNAPS];
static double timediffs[MAX_SNAPS];
static int count = 0;
static int maxi = 0;

void get_snapshot(int i)
{
    timesnaps[i] = _getcurtime();
    if (i == 0) {
        timediffs[i] = 0.0;
        count++;
    } else {
        timediffs[i] += (timesnaps[i] - timesnaps[i - 1]);
    }
    if (maxi < i) maxi = i;
}

void print_snapshot_summary(int n)
{
    if (count % n == 0) {
        printf("\n");
        for (int i = 0; i <= maxi; i++){
            printf("\t %" PRIu64, timesnaps[i]);
        }
        printf("\n");
    }
}

#endif
