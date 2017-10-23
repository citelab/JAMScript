#include <stdio.h>
#include <unistd.h>
#include<pthread.h>
#include<stdlib.h>
#include<unistd.h>
#include <string.h>
#include <stdlib.h>


void* startJ(void *arg) {
	char command[100];
	strcpy(command, "node jamout.js --app=progA");
	printf("%s\n", command);
	int x = system(command);
}

void* startC(void *arg) {
	char command[100];
	strcpy(command, "./a.out");
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

	int errC;
	errC = pthread_create(&tidC, NULL, &startC, NULL);
	if(errC != 0) {
		printf("Could not create thread for exec J.\n");
	} else {
		printf("Exec C completed succesfully.\n");
	}
}

int main() {
	return 0;
}