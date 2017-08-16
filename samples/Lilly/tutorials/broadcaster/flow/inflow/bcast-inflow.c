#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]){
	struct currentTime local;

	while(1){
		local = timeKeeping;
		printf("%d-%d-%d %d:%d:%d\n", local.year, local.month, local.date, local.hour, local.minute, local.second);
		sleep(1);
	}

	return 0;
}