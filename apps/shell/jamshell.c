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
void* execAtCloud(char *);

struct programInfo {
	char* path;
	char* name;
};

/**
* Starts the C node of an exec'd program
* @param name of the program to exec
*/
void* startC(void *pinfo) {

		struct programInfo *info = pinfo;

        char *args[5];
        args[0] = "a.out";
        args[1] = "-a";
        args[2] = (char*)info->name;
        args[3] = NULL;

        char* programPath = info->path;

        if (fork() == 0) {
        	char execDir[1024];
        	strcpy(execDir, programPath);
        	strcat(execDir, "/a.out");
        	printf("%s\n", execDir);
			execvp(execDir, args);
        }
        free(info);
}

jasync execProgGlobal(char* cmd) {
	printf("Got a global invocation call......\n");
	printf("%s\n", cmd);
	execAtCloud(cmd);
}

/**
* Takes care of spawning the pthread to exec the C node of pname
* @param name of the program to exec
*/
jasync execProg(char *path, char* progName) {
	struct programInfo *pinfo;
	pinfo = malloc(sizeof(*pinfo));
	pinfo->path = path;
	pinfo->name = progName;

	pthread_t tidC;
	sleep(1);
	int errC;
	errC = pthread_create(&tidC, NULL, &startC, pinfo);
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
