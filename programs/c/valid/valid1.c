// Proprocess line
#10"test"
#0"test2"
#0"test3"1

#include <stdio.h>

// External declaration
int test = 0;
struct point {
	int x;
	int y;
};


// Prototype
extern int* testExtern(int a, double b);
extern int testExtern2();
static int var;


// Function declaration
int testSwitch(int input) {
	int output = 0;
	// Switch statement and labelled statements
	switch(input) {
		case 1: 
			printf("Input is 1");
			break;
		case 2:
		case 3:
			printf("Input is between 1 and 4");
			break;
		case 4: 
			printf("Input %d is 4", input);
			break;
		default: break;
	}
	output = input++;
	return output;
}

int main() {

	int output = 0;

	// Function calls
	output = testSwitch(3);

	// Nested if/else 
	if (output > 0) {
		printf("Output %d is positive", output);
		int output1 = output++;
		if (output > 1) {
			printf("Output %d + 1 is %d\n", output, output1);
		} else if (output < 1) {
			printf("Output is %d\n", output);
		} else {
			int test = output1++;
			printf("Output is 1\n");
		}
	} else {
		printf("Output %d is negative\n", output);
	}

	int cond = 0;

	// while loop
	do {
		cond--;
		continue;
	} while (cond > -100 && cond < 0);

	while (!cond); 

	// for loop
	int i = 0;
	int count = 0;
	for (i = -150; i < cond; i++) {
		count += 1;
	}

	// cast
	double testCast = (double) count;

	// Pointer and array
	char *arr1 = "hello world";
	int size = sizeof(arr1)/sizeof(char);
	char arr2[size];
	for (int i = 0; i < size; i++) {
		arr2[i] = arr1[i];
	}


	// Struct declaration
	struct point origin = {0, 0};
	// Designator
	struct point originDup =  {.x = origin.x, .y = origin.y};

	struct point *originPtr = &origin;

	// Func pointer
	int (*testSwitchPtr) (int) = &testSwitch;
	(*testSwitchPtr)(0);

	return 0;
}