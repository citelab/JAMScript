#include "dpanel.h"

int main(int argc, char *argv[])
{
    dpanel_t *dp = dpanel_create("127.0.0.1", 6379);
    dpanel_start(dp);
}
