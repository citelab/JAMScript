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




## Preparing your system (macOS)

TO DO

## Preparing your Raspberry Pi

TO DO

## Preparing your Arduino Yun

TO DO


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
