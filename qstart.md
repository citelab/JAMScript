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
        if(operator == 'q' ) {
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

Now, lets looks at the J side. The J side, introduces a JAMScript keyword - **jsync**. Simply by putting this keyword
in front of the function, we have asked the compiler to export the function to the C side. Of course, proper matching
C prototypes (as shown in the above code block) are necessary to complete the export.
```javascript
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

Save the C block as `calc.c` and J block as `calc.js`. Now, run the following command to compile the files.
```shell
djam pull mahes25/jamscript
djam compile calc.c calc.js
```

After running the above commands, you should see the JAMScript executable `calc.jxe` in the directory where the
source files are located. The `djam pull` command brought in a docker image with JAMScript language. The `djam compile`
command compiled the source files inside a docker container. The resulting executable `calc.jxe` is copied back to the original
location.

To run `calc.jxe`, issue the following commands.
```shell
djam init --zones 2 --indelay=3:1 --outdelay=5:2 --cldelay=18:5
djam run calc.jxe --num=2 --bg
```

The `djam init` command is setting up the network topology for the cluster of dockers. In this particular example, it is
not useful. However, the `djam run` command will not run without a valid topology setup.
Here, the `djam run` command is executing `calc.jxe` in the background. It runs a single J node and 2 C nodes (observe the **--num** option).

Now, run `jam list` to see the status of the execution.

You should see a listing like the following.
```shell
ID         NAME      PROGRAM         HOST         D-STORE       TYPE C-NODES    TMUX-ID
app-457        app-n        calc 76b9053e2844     docker:6379     device       2 u-501-device-461-dev
```

Since we did not specify the application name the `djam run` with the **--app** option, the default application (*app-n*) is
used in the execution. Remember the command line interface (CLI) is running in the C node. So, to interact with the application
we need to open a terminal to the C node. Here, we have two C nodes running. The **tmux id** for the J node is shown in the
above listing. You can append `-` and node id of the C node to get the tmux id for the C node.

Run the following commands to see the two terminals.
```shell
jam term u-501-device-461-dev-1
jam term u-501-device-461-dev-2
```

We are using tmux. So, to detach use `Ctrl-B d`.

To stop the application executing in the above listing, we need to run the following command.
```shell
jam kill app-457
```
