---
layout: page
title: Run
subtitle: Compiling and running a JAMScript program
---

## Inside a Docker container

JAMScript can be compiled and run without a local installation. This is the simplest way to try out JAMScript. You need a local installation only if you want to debug or develop JAMScript itself! The following are the preparatory steps to get Docker JAM tools working in your system.

1. Download **JAMTools** into a local directory called `tools` like `git clone https://github.com/anrl/JAMTools tools`. 
2. Add the `tools` directory to your execution path. This way `djam` and `jam` tools are available for you.
3. Make `docker` run without `sudo`. 
4. Test that you actually completed Step 3 successfully. Use a command like `docker ps` and see whether it runs.
5. Pull the docker container with JAMScript. Use `djam pull mahes25/jamscript`. 

Everything should be setup at this point. Type `djam` or `jam` and you should see a menu of sub commands available under each of them.

To compile a JAMScript program, do the following. 
1. Write or get a JAMScript program. The easiest is to download the **JAMSamples**. Run `git clone https://github.com/anrl/JAMSamples samples` to download many example programs into a `samples` folder. 
2. Change to a folder containing a valid JAMScript program. `cd samples/JData/String_Log` will change to the folder containing the string logging example. 
3. To compile this program: `djam compile stringlog.*`. 
4. After a successful compile, you should see `stringlog.jxe` in the folder. If not, the compilation did not succeed. You should have seen some error messages in the console to that effect.
5. Once you have compiled the sample program, you can run the program in different ways: in a device, fog, or cloud. When you run in a device, you can specify different number of C nodes as well. By default, the `djam run` sub command creates a single C node.

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
