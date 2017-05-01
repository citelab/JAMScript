char* getJob(int);
jasync returnResults(int, int);

int id;
int complete = 0;
int pause = 0;

jasync startJobs() {
	pause = 0;
}

jasync finish() {
	complete = 1;
}

// Generate a random id
void setId() {
	struct timespec ts;
	clock_gettime(CLOCK_MONOTONIC, &ts);
	srand((time_t)ts.tv_nsec);

	id = rand();
}

int doJob() {
	char * input = getJob(id);
	if(input[0] != '\0') {
		int sum = 0;
		for(int i = 0; i < strlen(input); i++) {
			sum += input[i];
		}
		returnResults(id, sum);
		return 0;
	} else {
		return 1;
	}
}

int main() {
	int pause;
	id = random();

	while(complete == 0) {
		pause = doJob();
		while(pause == 1 || complete == 0);	
	}

	return 0;
}