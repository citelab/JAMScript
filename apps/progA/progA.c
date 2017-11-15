// #include <stdio.h>

// char* simple_data();

// int main() {
// 	printf("Received: %s\n", simple_data());
// 	return 0;
// }

jsync int J2Ccall() {
	printf("Printing from C...\n");
	return 99;
}

int main() {
	printf("In C main..\n");
}