#include <stdio.h>

int add(int, int);
int subtract(int, int);
int multiply(int, int);
int divide(int, int);


int main() {

    char operator;
    int num1, num2;

	while(1) {
		printf("Enter an operator (+, -, *, /) or q to quit:");
		scanf("%c", &operator);
		if(operator == 'q' ){ 
			break;
		}
		printf("Enter the first integer operand: ");
		scanf("%i", &num1);

		printf("Enter the second integer operand: ");
		scanf("%i", &num2);

		switch(operator) {
			case '+':
				printf("%i + %i = %i\n", num1, num2, add(num1, num2));
				break;
			case '-':
				printf("%i - %i = %i\n", num1, num2, subtract(num1, num2));
				break;
			case '*':
				printf("%i * %i = %i\n", num1, num2, multiply(num1, num2));
				break;
			case '/':
				printf("%i / %i = %i\n", num1, num2, divide(num1, num2));
				break;
			// operator doesn't match any case constant (+, -, *, /)
			default:
				printf("Error! operator is not correct\n");
		}
		
		//Lazy input clear
		int c;
		while ((c = getchar()) != '\n' && c != EOF) {}
	}
    return 0;
}