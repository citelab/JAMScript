# JAMShell
##### A shell written in JAMScript.  

The purpose of this shell is primarily to provide a method deploying JAMScript programs on multiple nodes without boostrapping as well as to demonstrate the capabilities of the language. JAMShell follows the JAMScript paradigm of "program as trees".

##### How to use: 
JAMShell is comprised of `jamshell.c` and `jamshell.js`.

###### Compiling and running: `jamc jamshell.*`
This produces a jamshell.jxe file.

To start the J node:
`runj jamshell.jxe --app=X [--fog/cloud] [--port=Y]`
To start the C node:
`runc jamshell.jxe --app=X`

##### Available commands:

- `jpwd` - prints the current working directory.
- `jcd` - Changes directory for all J nodes.
- `jls` - Lists the current directory contents.
- `exit` - exits the shell, terminating spawned programs.
- `exec path/to/progX` - Executes a compiled JAMScript program from the shell. Accepts a relative path to the program.
- `exec progX > outfile.txt` - Executes a program, redirecting the output to a file.
- `exec progX < inputFile.txt` - Executes a program, redirecting input from a file.
- `exec progX <> progY` - Executes program X, piping its output to program Y.
- `nodes` - Lists the name, and type of the nodes in the encapsulated subtree of the current node.
- `nodes all` - Lists the name, and type of the nodes in the global tree. Output is displayed from the highest level node.
- `jobs` - Lists spawned programs in the encapsulated subtree of the current node.
- `roots` - Lists the roots of the current node. From a device, this would list the cloud and fog nodes, from a fog, it would list the cloud node, and from the cloud it would list nothing.
- `health` - Lists the current node status (uptime).


*NOTE: `exec` commands expect the program to exist (compiled). To run progA/B/C from the shell, you need to have these programs compiled somewhere in your file system, and give the relative path as argument.
