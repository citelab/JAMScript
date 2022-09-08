#include <stdio.h>

#include "tboard.h"
#include <pthread.h>
#include <time.h>
#include <stdbool.h>

#include "main.h"

#if RUN_TEST == 0 && RUN_LTEST == 0




int main() {
	printf("Hello world! Welcome to task board.");
	return 0;
}



#endif

/*
#define COLLATZ_ITERATIONS 5000000
#define SECONDARY_EXECUTORS 10
struct collatz_iteration {
	int starting_x;
	int current_iteration;
	unsigned long current_x;
};

tboard_t *tboard = NULL;
int n = 0;
int NUM_TASKS = COLLATZ_ITERATIONS;
struct collatz_iteration iterations[COLLATZ_ITERATIONS];
int completion_count = 0;
int task_count = 0;
double yield_count = 0;
int priority_count = 0;
bool print_priority = true;
int max_tasks_reached = 0;
pthread_t killer_thread, priority_creator_thread;
pthread_mutex_t count_mutex;

void increment_completion_count(){
	pthread_mutex_lock(&count_mutex);
	completion_count++;
	pthread_mutex_unlock(&count_mutex);
}

void priority_task(void *args)
{
	int priority_count = (int)task_get_args();
	if(print_priority)
		tboard_log("priority: Priority task %d is executing at CPU time %d!!!\n", priority_count, clock());
}

void secondary_task(void *);

void check_completion(void *args){
	while(true){
		if(completion_count >= NUM_TASKS){
			pthread_mutex_lock(&(tboard->tmutex));
			tboard_log("Completed Collatz Test for %d numbers with %e yields.\n",task_count, yield_count);
			tboard_log("Max tasks reached %d times. There were %d priority tasks executed.\n", max_tasks_reached, priority_count);
			pthread_cancel(killer_thread);
			pthread_cancel(priority_creator_thread);
			
			tboard_kill(tboard);
			int unfinished_tasks = 0;
			int cond_wait_time = clock();
			pthread_cond_wait(&(tboard->tcond), &(tboard->tmutex));
			cond_wait_time = clock() - cond_wait_time;
			for(int i=0; i<MAX_TASKS; i++){
				if (tboard->task_list[i].status != 0)
					unfinished_tasks++;
			}
			tboard_log("Found %d unfinished tasks, waited %d CPU cycles for condition signal.\n", unfinished_tasks, cond_wait_time);
			
			
			pthread_mutex_unlock(&(tboard->tmutex));
			break;
		}
		usleep(300);
		//task_yield(); yield_count++;
	}
}

void primary_task(void *args)
{
	int i = 0;
	tboard_log("primary: Creating %d many different tasks to test 3x+1\n", NUM_TASKS);
	for (; i<NUM_TASKS; i++) {
		iterations[i].current_iteration = (i == 1) ? 1 : 0;
		iterations[i].starting_x = i;
		iterations[i].current_x = (i == 0) ? 1 : i;
		while(false == task_create(tboard, secondary_task, SECONDARY_EXEC, &iterations[i])){
			if(print_priority)
				tboard_log("primary: Max tasks occured at secondary task %d, trying again shortly.\n", i);
			max_tasks_reached++;
			usleep(300);
			task_yield(); yield_count++;
		}
		task_count++;
		task_yield(); yield_count++;
	}
	//while(task_create(tboard, check_completion, PRIMARY_EXEC, NULL) == false){
	//	max_tasks_reached++;
	//	usleep(300);
	//}
	tboard_log("primary: Created %d tasks to test 3x+1.\n", i);
	
	task_yield(); yield_count++;
	// create test function
	
}
void secondary_task_no_persist(void *args){
	int x = ((struct collatz_iteration *)(task_get_args()))->starting_x;
	int i = 0;
	while(x != 1){
		if(x % 2 == 0)  x /= 2;
		else 			x = 3*x+1;
		i++;
		task_yield(); task_count++;
	}
}

void secondary_task(void *args)
{
	struct collatz_iteration *iter = (struct collatz_iteration *)task_get_args();


	if (iter->starting_x <= 1) {
		if (iter->starting_x >= 0){
			increment_completion_count();
			return;
		} else {
			tboard_err("secondary: Invalid value of x encountered in secondary task: %d\n", iter->starting_x);
			return;
		}
	}
	// TODO: implement mutex on freeing task board to collect this information
	//task_store_data(&iter, sizeof(struct collatz_iteration));
	while (iter->current_x != 1) {
		//task_retrieve_data(&iter, sizeof(struct collatz_iteration));
		if (iter->current_x % 2 == 0) {
			// we wish to half our value
			iter->current_x /= 2;
		} else {
			// we do 3x+1
			iter->current_x = 3*(iter->current_x) + 1;
		}
		iter->current_iteration++;

		//task_store_data(&iter, sizeof(struct collatz_iteration));
		task_yield(); yield_count++;
	}

	//task_retrieve_data(&iter, sizeof(struct collatz_iteration));
	increment_completion_count();
}

void tboard_killer(void *args){
	return;
	int sleep_time = 10 + (rand() % 100);
	sleep(sleep_time);
	pthread_cancel(*((pthread_t *)args));
	pthread_mutex_lock(&(tboard->tmutex));
	tboard_kill(tboard);
	int unfinished_tasks = 0;
	pthread_cond_wait(&(tboard->tcond), &(tboard->tmutex));
	for(int i=0; i<MAX_TASKS; i++){
		if (tboard->task_list[i].status != 0)
			unfinished_tasks++;
	}
	pthread_mutex_unlock(&(tboard->tmutex));
	tboard_log("Confirmed conjecture for %d of %d values in time %d with %e yields.\n", completion_count, task_count, sleep_time, yield_count);
	tboard_log("Max tasks reached %d times. There were %d priority tasks executed.\n", max_tasks_reached, priority_count);
}

void priority_task_creator(void *args){
	priority_count = 0;
	while(true){
		sleep(rand() % 20);
		if(print_priority)
			tboard_log("priority: issued priority task at CPU time %d\n",clock());
		bool res = task_create(tboard, priority_task, PRIORITY_EXEC, priority_count);
		if(res)
			priority_count++;
	}
}

int main(int argc, char **argv)
{
	if(argc > 1) print_priority = false;
	pthread_mutex_init(&count_mutex, NULL);
	tboard = tboard_create(SECONDARY_EXECUTORS);

	

	tboard_start(tboard);

	pthread_t pcompletion;
	
	pthread_create(&priority_creator_thread, NULL, priority_task_creator, NULL);
	pthread_create(&killer_thread, NULL, tboard_killer, &priority_creator_thread);
	pthread_create(&pcompletion, NULL, check_completion, NULL);

	task_create(tboard, primary_task, PRIMARY_EXEC, NULL);
	
	pthread_join(priority_creator_thread, NULL);
	pthread_join(killer_thread, NULL);
	tboard_destroy(tboard);
	pthread_join(pcompletion, NULL);

	if(argc <= 1){
		printf("========= Printing number of steps to reach 1 (A006877 in OEIS) to A006877.txt =======\n");
		FILE *f = fopen("A006877.txt", "w");

		int max_steps = 0;
		int max_n = 0;
		for(int i=0; i<task_count; i++){
			if (iterations[i].current_x == 1) {
				fprintf(f, "%d\n", iterations[i].current_iteration);
				if(iterations[i].current_iteration > max_steps){
					max_steps = iterations[i].current_iteration;
					max_n = i;
				}
			} else
				fprintf(f, "unf.\n");
		}
		fclose(f);
		printf("Max steps: n=%d took %d iterations to complete.\n",max_n, max_steps);
		if(completion_count < task_count){
			printf("Could not complete some iterations:\n");
			for(int i=0; i<task_count; i++){
				if(iterations[i].current_x != 1)
					printf("\tn=%d performed %d iterations ending at %d.\n",iterations[i].starting_x, iterations[i].current_iteration, iterations[i].current_x);
			}
		}
	}
	pthread_mutex_destroy(&count_mutex);
	tboard_exit();
	return (0);
}




tboard_t *tboard = NULL;
int n = 0;
void task_one(void *args){
	printf("Task one started! %d\n",pthread_self());
	task_yield();
	for(int i=0; i<10; i++){
		printf("Task one on %d: %d\n",i,pthread_self());
		usleep(10);
		task_yield();
	}
}

void task_two(void *args){
	printf("Task two started! %d\n",pthread_self());
	task_yield();
	for(int i=0; i<10; i++){
		printf("Task two on %d: %d\n",i,pthread_self());
		usleep(10);
		task_yield();
	}
}
void task_spawnling(void *arg){
	int i = (n++);
	printf("Spawnling %d Start on %d\n",i, pthread_self());
	task_yield();
	printf("Spawnling %d Ended on %d\n",i, pthread_self());
}

void task_spawning_tasks(void *args){
	printf("=== Spawning some tasks and ending ===\n");
	for(int i=0; i<100; i++){
		task_create(tboard, task_spawnling, 1, NULL);
	}
	task_create(tboard, task_spawnling, 0, NULL);
	task_yield();
	for(int i=0; i<100; i++){
		task_create(tboard, task_spawnling, 1, NULL);
		usleep(3000);
	}
	task_yield();
	printf("==== Spawning Ended ===");
}

void kill_tboard_at_some_point(void *args){
	while(true){
		if(rand() % 10 == 5){
			tboard_kill(tboard);
			break;
		}else{
			sleep(1);
		}
	}
}

void yield_tboard_at_some_point(void *args){
	mco_result res;
	while(true){
		printf("Yielding straggling task\n");
		for(int i=0; i<MAX_TASKS; i++){
        	if(tboard->task_list[i].status != 0){
				res = mco_yield(tboard->task_list[i].ctx);
			}
		}
		printf("Completed yield with result: %s\n", mco_result_description(res));
		sleep(1);
	}
}

void straggling_task(void *args){
	int n = 0;
	while(true){
		sleep(2);
		printf("Finished long sleep %d\n",++n);
	}
}

int main_bad(){
	printf("Creating tboard\n");
	tboard = tboard_create(2);

	printf("Starting Tboard\n");
	tboard_start(tboard);
	task_create(tboard, straggling_task, 0, NULL);

	pthread_t yielder;
	pthread_create(&yielder, NULL, yield_tboard_at_some_point, NULL);


	tboard_destroy(tboard);
	printf("Tboard is done\n\n");
	pthread_join(yielder, NULL);
	tboard_exit();
	return (0);
}


int main()
{
	printf("Creating tboard\n\n");
	tboard = tboard_create(10);

	pthread_t killer_thread;
	pthread_create(&killer_thread, NULL, kill_tboard_at_some_point, NULL);

	printf("Tboard created\n\n");
	tboard_start(tboard);
	printf("Tboard started\n\n");

	task_create(tboard, task_one, 0, NULL);
	printf("Task 1 created\n\n");
	task_create(tboard, task_two, 1, NULL);
	printf("Task 2 created\n\n");
	
	task_create(tboard, task_spawning_tasks, 0, NULL);
	sleep(1);
	printf("\n\n============== NEXT BATCH ===============");

	task_create(tboard, task_one, 0, NULL);
	printf("Task 1 created\n\n");
	task_create(tboard, task_two, 1, NULL);
	printf("Task 2 created\n\n");



	tboard_destroy(tboard);
	printf("Tboard is done\n\n");
	pthread_join(killer_thread, NULL);
	tboard_exit();
	return (0);
} */