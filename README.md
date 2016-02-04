# JAM
JavaScript Machine: A Middleware for Things, Web, and Cloud

### Compiling a JAM program
You must first build jamlib.a:
```sh
cd lib/jamlib
make
```
This will create a jamlib.a file

<br />
Then you can compile a JAM file:
```sh
./jamcompile.sh [input file] [jamlib.a path] [output name (optional)]
```
This will produce a jxe file in the output folder, by default it will be named jamout.jxe



### Running a JAM progarm
First build jamrun:
```sh
cd lib/jamrun
make
```

##### Running jamrun:
C Mode:
```sh
cd lib/jamrun
./jamrun -c [jxe path]
```

JS Mode:
```sh
cd lib/jamrun
./jamrun -j [jxe path]
```
