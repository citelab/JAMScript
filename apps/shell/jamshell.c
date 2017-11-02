#include <stdio.h>
#include <unistd.h>
#include<pthread.h>
#include<stdlib.h>
#include<unistd.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>

time_t start;
char* getNodeName();

/**
* Starts the C node of an exec'd program
* @param name of the program to exec
* You'll need to use your own path of where the a.out of the program to be execd is.
*/
void* startC(void *pname) {
		printf("%s\n", pname);
        char *args[5];
        args[0] = "a.out";
        args[1] = "-a";
        args[2] = (char*)pname;
        args[3] = NULL;

        if (fork() == 0) {
        	char path[80];
        	strcpy(path, "/Users/oryx/"); //Change this to the a.out of pname
        	strcat(path, args[2]);
        	strcat(path, "/a.out");
        	printf("%s\n", path);
			execvp(path, args);
        }
}
/**
* Returns the current working directory
*/
jsync char* pwd() {
	char cwd[1024];
	return getcwd(cwd,sizeof(cwd));
}

/**
* Takes care of spawning the pthread to exec the C node of pname
* @param name of the program to exec
*/
jasync execProg(char *pname) {
	printf("%s\n", pname );
	pthread_t tidC;
	sleep(1);
	int errC;
	errC = pthread_create(&tidC, NULL, &startC, pname);
	if(errC != 0) {
		printf("Could not create thread for exec C.\n");
	} else {
		printf("Exec C completed succesfully.\n");
	}	
	pthread_detach(tidC);
}

int main() {
	start = time(NULL);
	printf("Node online.\n");
}