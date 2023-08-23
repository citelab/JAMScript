#ifndef DATAOINT_H
#define DATAOINT_H

#include <time.h>

struct DataPoint
{
    time_t time;
    float x;
    float y;
};

struct DataPoint CreateDataPoint(time_t datetime, float x, float y);

#endif
