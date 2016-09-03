# JAMScript: A Language and Middleware for Cloud of Things

## Overview

Cloud of Things (CoT) is a computing model that combines the widely popular
cloud computing with Internet of Things (IoT).
One of the major problems
with CoT is the latency of accessing distant cloud resources from the
devices, where the data is captured. To address this problem, paradigms such
as fog computing and Cloudlets have been proposed to interpose another layer
of computing between the clouds and devices. Such a three-layered
cloud-fog-device computing architecture is touted as the most suitable
approach for deploying many next generation ubiquitous computing
applications. Programming applications to run on such a platform is quite
challenging because disconnections between the different layers are bound to
happen in a large-scale CoT system, where the devices can be mobile.

JAMScript is a polglot programming language that combines C and JavaScript
for a three-layered CoT system. A proof-of-concept compiler and runtime for
different distributed systems are provided in this repository.
Our goal is to get JAMScript to work in many platforms so that heterogeneous
systems can be developed using it. You can see the associated publications to
learn about the whole concept.

This is an open source project. If you are interested in contributing towards this
project, we would be delighted to hear from you. Please contact maheswar@cs.mcgill.ca
for more information.

## Preparing your system (Ubuntu)    

Unfortunately, Ubuntu package distribution does not have the latest version for
all required software. So we need to install them manually.

scons version 2.5 or later is best. Following commands can be used to install
scons.
```
cd /tmp or a download directory
wget http://prdownloads.sourceforge.net/scons/scons-2.5.0.tar.gz
tar zxvf scons-2.5.0.tar.gz
cd scons-2.5.0
sudo python setup.py install
```

Check your node version. If you have a node that is 6.3.1 or later you can skip this
step. Here are the instructions for Node 6.5.0.
```
sudo apt-get install xz-utils
wget https://nodejs.org/dist/v6.5.0/node-v6.5.0-linux-x64.tar.xz
sudo tar -C /usr/local --strip-components 1 -xJf node-v6.5.0-linux-x64.tar.xz

```
You should have the NodeJS and NPM installed now.

JAMScript uses tcc. You need to install it.
If you have makeinfo you can proceed. Otherwise, you need install makeinfo using
```
sudo apt-get install texinfo
```

Now get tcc and install it as follows.
```
cd to your downloads directory
git clone http://github.com/wenger/tcc.git
cd tcc
./configure
make
sudo make install
```


libcborgit clone http://github.com/wenger/tcc.git
nanomsg


Now install the libraries that are needed for JAMScript compilation.

sudo apt-get install xz-utils
sudo tar -C /usr/local --strip-components 1 -xJf node-v6.5.0-linux-x64.tar.xz





Next, install a NodeJS 6.3.1 or later. Check your node version if it is already
You need to install the latest NodeJS

It is best to have a scons version 2.5 or later.


The gcc version needs to be 5.0 or above. Following commands can be
used to install a version 5 gcc compiler.

```
sudo add-apt-repository ppa:ubuntu-toolchain-r/test
sudo apt-get update
sudo apt-get install gcc-5 g++-5

sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-5 1
```



to set first priority to gcc-5

## Preparing your system (macOS)

JAMScript is already tested in macOS. We need to get the preparation instructions done for
it!

## Preparing your Raspberry Pi

Not yet tested. It is best to cross compile JAMScript to Raspberry Pi although
RPI3 is powerful enough to compile JAMScript.

## Preparing your Arduino Yun

Definitely need a JAMScript cross compiler.
Need testing and documentation.

## Installing JAMScript


## Hello World


## More advanced JAMScript deployments




JavaScript Machine: A Middleware for Things, Web, and Cloud

#### Installing jam
Run:
```sh
./install.sh
```

##### Compiling a JAM program

```sh
jamc [input file] [output name (optional)]
```
This will produce a jxe file in the output folder, by default it will be named jamout.jxe



##### Running a JAM progarm

JavaScript Mode:
```sh
jamrun -j [jxe path]
```

C Mode:
```sh
jamrun -c [jxe path]
```
