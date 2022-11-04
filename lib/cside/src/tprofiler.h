
#ifndef __TPROFILER_H__
#define __TPROFILER_H__

// Profiler for performance mapping.
// We want to use this simple profiler determine the bottleneck portions of the code

#include <time.h>
#include <stdio.h>

long int _getcurtime()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000000000 +  ts.tv_nsec;
}

#define MAX_SNAPS               32
static long int timesnaps[MAX_SNAPS];
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
        for (int i = 0; i <= maxi; i++)
            printf("\t %f", timediffs[i]/count);
        printf("\n");
    }
}

#endif