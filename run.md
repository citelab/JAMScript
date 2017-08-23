---
layout: page
title: Run
subtitle: Compiling and running a JAMScript program
---


## Trying out the JAMScript compiler

### Running the example programs

JAMScript comes with a bunch of sample programs. You can cd into `samples/Lilly/tutorials/logger/simple/` to try out some typical use-cases.

A JAMScript executable has native (compiled C) and Node (JavaScript) components.
To compile the C and J nodes, we need `jamc` to compile them together.  

For example, to compile C-node `logger.c`, J-node `logger.js`, we do the following command:  

```shell
jamc logger.c logger.js
```

The compiled files for us to run are `jamout.js` and `a.out` by default.    
In most cases, we need to run the J-node before the C-node by doing `node jamout.js --app=APP_NAME`. Here `APP_NAME` is a user-defined name of the running application. Other options can also be specified.  
To run the C-node, we simply open a new tab, type `./a.out`, and press Enter. Other options can be supplied here as well.