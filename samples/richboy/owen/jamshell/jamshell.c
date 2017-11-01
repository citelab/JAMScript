#include <stdio.h>
#include <unistd.h>
#include<pthread.h>
#include<stdlib.h>
#include<unistd.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>

time_t start;
char* getNodeName();

void* startC(void *arg) {
        char *args[5];

        args[0] = "a.out";
        args[1] = "-a";
        args[2] = "progA";
        args[3] = NULL;

        if (fork() == 0) {
          execvp("/Users/oryx/progA/a.out", args);
        }
}

void* startCB(void *arg) {
        char *args[5];

        args[0] = "a.out";
        args[1] = "-a";
        args[2] = "progB";
        args[3] = NULL;

        if (fork() == 0) {
          execvp("/Users/oryx/progB/a.out", args);
        }
}


void* startCC(void *arg) {
        char *args[5];

        args[0] = "a.out";
        args[1] = "-a";
        args[2] = "progC";
        args[3] = NULL;

        if (fork() == 0) {
          execvp("/Users/oryx/progC/a.out", args);
        }
}

jsync char* pwd() {
	char cwd[1024];
	return getcwd(cwd,sizeof(cwd));
}


jasync execProg() {

	pthread_t tidC;
	sleep(1);
	int errC;
	errC = pthread_create(&tidC, NULL, &startC, NULL);
	if(errC != 0) {
		printf("Could not create thread for exec C.\n");
	} else {
		printf("Exec C completed succesfully.\n");
	}	
	pthread_detach(tidC);
	//jobs = "progA";
}

jasync execProgB() {

	pthread_t tidCB;
	sleep(1);
	int errC;
	errC = pthread_create(&tidCB, NULL, &startCB, NULL);
	if(errC != 0) {
		printf("Could not create thread for exec C.\n");
	} else {
		printf("Exec C completed succesfully.\n");
	}	
	pthread_detach(tidCB);
}


jasync execProgC() {

	pthread_t tidCC;
	sleep(1);
	int errC;
	errC = pthread_create(&tidCC, NULL, &startCC, NULL);
	if(errC != 0) {
		printf("Could not create thread for exec C.\n");
	} else {
		printf("Exec C completed succesfully.\n");
	}	
	pthread_detach(tidCC);
}

// jsync int logInfo() {
// 	int elapsed = (int)(time(NULL) - start);
//     info = {
//     	.uptime: elapsed,
//     	.nodeType: "NODE_TYPE",
//     	.nodeName: getNodeName()
//     };
//     return 0;
// }

int main() {
	start = time(NULL);
	printf("Node online.\n");
}