---
layout: page
title: Run
subtitle: Compiling and running a JAMScript program
---


## Trying out the JAMScript compiler

### Running the example programs

JAMScript comes with a bunch of sample programs. You can cd into samples/chat
and run `jamc chat.c chat.js` to compile the program. You should see `chat.jxe` in
that directory.

A JAMScript executable has native (compiled C) and Node (JavaScript) components.
To run the C and J nodes use the following commands.

```shell
jamrun -c chat.jxe
jamrun -j chat.jxe
```