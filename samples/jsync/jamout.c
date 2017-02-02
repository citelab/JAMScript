#include <unistd.h>
#include "jdata.h"
#include "jam.h"
#include <stdio.h>
typedef char* jcallback;
jamstate_t *js;
int add(int num1, int num2) {
arg_t *res = jam_rexec_sync(js, "add", "ii",num1, num2);
int ret = res->val.ival;
command_arg_free(res);
return ret;
}

int subtract(int num1, int num2) {
arg_t *res = jam_rexec_sync(js, "subtract", "ii",num1, num2);
int ret = res->val.ival;
command_arg_free(res);
return ret;
}

int multiply(int num1, int num2) {
arg_t *res = jam_rexec_sync(js, "multiply", "ii",num1, num2);
int ret = res->val.ival;
command_arg_free(res);
return ret;
}

int divide(int num1, int num2) {
arg_t *res = jam_rexec_sync(js, "divide", "ii",num1, num2);
int ret = res->val.ival;
command_arg_free(res);
return ret;
}

int user_main() {
char operator;
int num1, num2;
while(1) {
printf("Enter an operator (+, -, *, /) or q to quit:");
scanf("%c", &operator);
if(operator == 'q') {
exit(0);
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
default:
printf("Error! operator is not correct\n");
}
int c;
while((c = getchar()) != '\n' && c != EOF) {

}
}
return 0;
}

void user_setup() {
}

void jam_run_app(void *arg) {
user_main();
}

void taskmain(int argc, char **argv) {

    js = jam_init(1883);
    user_setup();
     
    taskcreate(jam_event_loop, js, 50000);
    taskcreate(jam_run_app, js, 50000);
  }
