# JAMShell

## Motivation

The main goal of JAMShell is to facilitate managing JAMScript programs on a large number of nodes. Initially one must log in to all of the nodes to start the shell. Then one can manage programs in any subtree of nodes from a single node.

## Compiling

To compile the shell along with its utilities packaged into `jamshell.jxe` run:
```
./build.sh
```

## Running

The shell can be run with `jamrun` or `djamrun`. Here are examples with `jamrun`:
```
jamrun jamshell.jxe --app=jamsh --data=127.0.0.1:7000 --cloud  # start a cloud node
jamrun jamshell.jxe --app=jamsh --data=127.0.0.1:7001 --fog    # start a fog node
jamrun jamshell.jxe --app=jamsh --data=127.0.0.1:7002          # start a device node
```

## Commands

- `pwd` prints the current working directory of the current node.

- `cd` changes the current working directory in the current node's subtree.

- `ls` lists the contents of the current working directory of the current node.

- `exec` executes compiled JAMScript programs in a subtree.

  To execute in the current node's subtree run:
  ```
  exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB]
  ```
  To execute in the entire tree run:
  ```
  exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @cloud
  ```
  To execute in fog X's subtree or the subtree of the fog above the current node run:
  ```
  exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @fog [X]
  ```
  To execute in device X's subtree run:
  ```
  exec prog1.jxe [> prog2.jxe ...] [< fileA] [> fileB] @device X
  ```
  In all cases, the arguments can be provided in any order.

- `jobs` lists all JAMScript programs spawned by the shell in the current node's subtree.

  Example of job listing:
  ```
  NODETYPE NODEID                               JOBID                                APP
  cloud    f17e42b0-efa8-4efa-b38a-af38ac43565c 0fc1c007-1594-4159-b9fb-639fef6c44e0 hello
  fog      8808436c-90dd-490d-9113-e111b915af75 0fc1c007-1594-4159-b9fb-639fef6c44e0 hello
  device   02c7fc4c-ea98-4ea9-88f3-b88fa01e7181 0fc1c007-1594-4159-b9fb-639fef6c44e0 hello
  ```
  The job listing is maintained across restarts of the shell. A user can exit the shell, start it again at a later time, and manage previously spawned programs.

- `kill` kills jobs in a subtree by APP (default) or JOBID.

  Example of killing by APP in the current node's subtree:
  ```
  kill hello
  ```
  Example of killing by JOBID in the current node's subtree:
  ```
  kill 0fc1c007-1594-4159-b9fb-639fef6c44e0 --id
  ```
  A particular subtree can be targeted as with the `exec` command.

- `info` displays information about the current node.
