char* getJob(int);
jasync returnResults(int, int);

int id;

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
		return 1;
	} else {
		return 0;
	}
}

int main() {
	id = random();

	while(doJob());

	return 0;
}