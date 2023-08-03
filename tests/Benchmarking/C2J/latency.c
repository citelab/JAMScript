#include <time.h>
//#include <locale.h>

const int BUF_LEN = 1024;

void remoteCall(char*);


#define NANO 1000000000L

// Nabbed from this: https://stackoverflow.com/questions/8304259/formatting-struct-timespec
// modified to remove date
int timespec2str(char *buf, uint len, struct timespec *ts) {
    int ret;
    struct tm t;

    tzset();
    if (localtime_r(&(ts->tv_sec), &t) == NULL)
        return 1;

    ret = strftime(buf, len, "%T", &t);
    if (ret == 0)
        return 2;
    len -= ret - 1;

    ret = snprintf(&buf[strlen(buf)], len, ".%09ld", ts->tv_nsec);
    if (ret >= len)
        return 3;

    return 0;
}

jtask* sendALotOfStuff()
{
    char buf[BUF_LEN];
    struct timespec now;
    while(true)
    {
	//remoteCall(2);
	jsleep(100);

	clock_gettime(CLOCK_REALTIME, &now);
	timespec2str(buf, BUF_LEN, &now);
	
	//printf("OKAY! %s\n", buf);
	//fflush(stdout);

	remoteCall(buf);

    }
}

int main()
{
    sendALotOfStuff();

    
    
}
