# JAMShell
##### A shell written in JAMScript.  

... 

##### How to use: 
JAMShell is comprised of `jamshell.c` and `jamshell.js`

###### Compiling and running: `jamc jamshell.*`

To start the J node:
`node jamout.js --app=X` 
To start the C node:
`./a.out -a X`

##### Available commands:

- `pwd` - prints the current working directory
- `exit` - exits the shell (DOES NOT TERMINATE SPAWNED PROGRAMS! (YET)). *You'll need to run `killall node` to terminate exec'd children*
- `exec progA` - Executes a compiled JAMScript program from the shell. You will need to change the path progA in the source code...
- `exec progB >` - Executes program B with output redirection. Currently redirects to screen only, not file. NOT WORKING.
- `exec progB | progC` - Executes program B, piping the output to program C.
- `nodes` - Lists names, types, and preceeding devices for each node in the system.
- Other commands a work in progress.


*NOTE: `exec` commands expect the program to exist (compiled). To run progA/B/C from the shell, you need to have these programs compiled somewhere in your file system. Currently, you will also need to change the path in the source code to match the location of these programs.

To do this, you will need to modify:

`execJNode(name)` found in `jamshell.js`
`startC(void *pname)` found in `jamshell.c`
