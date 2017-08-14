#include <stdio.h>
#include <unistd.h>
#include <time.h>

int main(int argc, char *argv[]){
	time_t rawtime;
	struct tm *t;

	while(1){
		time(&rawtime);
		t = localtime(&rawtime);		
		myClock = {
			.year: t->tm_year+1990, 
			.month: t->tm_mon,
			.date: t->tm_mday,
			.hour: t->tm_hour,
			.minute: t->tm_min,
			.second: t->tm_sec
		};
		sleep(1);
		//printf("%d\n", myClock.second);
	}

	return 0;
}