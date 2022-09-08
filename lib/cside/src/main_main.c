#include <stdlib.h>
#include <stdio.h>

#include "tboard.h"
#include "cnode.h"
#include <pthread.h>
#include <time.h>
#include <unistd.h>
#include <stdbool.h>
#include "main_main.h"
#include <pthread.h>

#if RUN_TEST == 0 && RUN_LTEST == 0


void *kill_tboard (void *args)
{
    tboard_t *t = (tboard_t *)args;
	sleep(5);
	pthread_mutex_lock(&(t->tmutex));
	tboard_kill(t);
	printf("Taskboard killed");
	pthread_mutex_unlock(&(t->tmutex));
}

int main(int argc, char **argv) {
	cnode_t *cnode = cnode_init(argc, argv);

	pthread_t tb_killer;
	pthread_create(&tb_killer, NULL, kill_tboard, cnode->tboard);

	printf("cnode_start\n");
	cnode_start(cnode);
	
	printf("cnode_destroy\n");
	cnode_destroy(cnode);

	printf("pthread_join\n");
	pthread_join(tb_killer, NULL);
}

void test_args(cnode_args_t *args) {
	printf("There are %d arguments:\n", args->argc);
	for (int i=0; i<args->argc; i++) {
		printf("%d: %s\n", i+1, args->argv[i]);
	}
}

int main_args_test(int argc, char **argv) {
	cnode_args_t *args = process_args(argc, argv);
	test_args(args);
	destroy_args(args);
	return 0;
}



#endif
