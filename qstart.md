---
layout: page
title: Quick Start
subtitle: A Tutorial Introduction to JAMScript
---

## Preliminary Setup

The easiest way to start programming JAMScript it is use the docker installation.
Follow the instructions in the [docker installation](../docker) page to get the tools and images for the
docker-based JAMScript.

At this point, any examples related to JView (the visualization and control part of JAMScript)
will not work with a docker-based installation.

## A Calculator Example

In this quick start, we will use a simple calculator example. The CLI for the calculator is
implemented in the C node. The calculating server is implemented in the J node. We can run multiple
CLI (C) nodes with a single calculating server.

The listing below shows the JAMScript enhanced C code that implements the C node. In this
particular example there is no JAMScript specific constructs in the C code. As the four external
functions (`add`, `subtract`, `multiply`, `divide`)
are not implemented in the C side, you would expect them to be implemented by the J (JavaScript) side.
```C
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
```

Now, lets looks at the J side.
```JavaScript
jsync function add(num1, num2) {
    return num1 + num2;
}

jsync function subtract(num1, num2) {
    return num1 - num2;
}

jsync function multiply(num1, num2) {
    return num1 * num2;
}

jsync function divide(num1, num2) {
    return num1 / num2;
}
```
