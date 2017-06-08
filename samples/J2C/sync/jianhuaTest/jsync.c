#include <stdio.h>


jsync int fakeRandom(char *s)
{
    printf("sync time: %f\n", getcurtime());
	int n = rand() % 100;
	printf("Random: %d\n", n);
	return n;

}

jsync int realRandom(char* s){
	srand(time(0));
	int n = rand() % 100;
	printf("real random: %d\n", n);
	return n;
}





int main()
{
    printf("In the main...\n");
	double now = getcurtime();
	printf("now: %f\n", now);
	double start = now + 20.0;
	while(getcurtime() < start) {

	}
	printf("starting: %f\n", getcurtime());
	return 0;
}
