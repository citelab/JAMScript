#include "tests.h"
#include <time.h>


double rand_double(double min, double max)
{
    double scale = (double)(rand()) / (double)RAND_MAX;
    return min + scale*max;
}

void fsleep(float max_second)
{
    float seconds = (float)rand() / (float)(RAND_MAX/max_second);
    int s = (int)seconds;
    long ns = (long)(1000000000 * (seconds - s));
    struct timespec ts = {
        .tv_sec = s,
        .tv_nsec = ns,
    };
    nanosleep(&ts, NULL);
}

void increment_count(int *value)
{
//    pthread_mutex_lock(&count_mutex);
	*value = *value + 1;
//	pthread_mutex_unlock(&count_mutex);
}

int read_count(int *value)
{
//	pthread_mutex_lock(&count_mutex);
	int ret = *value;
//	pthread_mutex_unlock(&count_mutex);
    return ret;
}


