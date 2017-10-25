#include <stdio.h>
#include <unistd.h>
#include<pthread.h>
#include<stdlib.h>
#include<unistd.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>


clock_t begin;

void* startJ(void *arg) {
	char command[100];
	strcpy(command, "node jamout.js --app=progA");
	printf("%s\n", command);
	int x = system(command);
}

void* startC(void *arg) {
	char command[100];
	strcpy(command, "./a.out -a progA");
	printf("%s\n", command);
	int x = system(command);
}

jsync char* pwd() {
	char cwd[1024];
	return getcwd(cwd,sizeof(cwd));
}

jasync exec() {

	chdir("/Users/oryx/progA");

	printf("Finding program...\n");

	char cwd[1024];
	printf("%s\n",getcwd(cwd,sizeof(cwd)));

	pthread_t tidJ;
	pthread_t tidC;

	int errJ;
	errJ = pthread_create(&tidJ, NULL, &startJ, NULL);
	if(errJ != 0) {
		printf("Could not create thread for exec J.\n");
	} else {
		printf("Exec J completed succesfully.\n");
	}
	sleep(5);
	int errC;
	errC = pthread_create(&tidC, NULL, &startC, NULL);
	if(errC != 0) {
		printf("Could not create thread for exec C.\n");
	} else {
		printf("Exec C completed succesfully.\n");
	}	
	pthread_join(tidC, NULL);
	printf("Never reaches here....\n");
	jobs = "progA";
}

jasync logInfo() {
	clock_t end = clock();
	// printf("LOGGING TIME: \n");
	// printf("begin: %lu\n", begin/CLOCKS_PER_SEC);
	// printf("end: %lu\n", end/CLOCKS_PER_SEC);
	float time = (float)(end-begin) / CLOCKS_PER_SEC;
	printf("%f\n", time);
    info = {
    	.uptime: time,
    	.nodeType: "NODE_TYPE"
    };
}

int main() {
	begin = clock();
	printf("Node online.\n");
	return 0;
}