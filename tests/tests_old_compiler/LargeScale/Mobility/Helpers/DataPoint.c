#include "DataPoint.h"

struct DataPoint CreateDataPoint(time_t datetime, float x, float y) {
    struct DataPoint dp;
    dp.time = datetime;
    dp.x = x;
    dp.y = y;

    return dp;
}
