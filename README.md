# JAMScript: A Language and Middleware for Cloud of Things

Cloud of Things (CoT) is a computing model that combines the widely popular
    cloud computing with Internet of Things (IoT). One of the major problems
    with CoT is the latency of accessing distant cloud resources from the
    devices, where the data is captured. To address this problem, paradigms such
    as fog computing and Cloudlets have been proposed to interpose another layer
    of computing between the clouds and devices. Such a three-layered
    cloud-fog-device computing architecture is touted as the most suitable
    approach for deploying many next generation ubiquitous computing
    applications. Programming applications to run on such a platform is quite
    challenging because disconnections between the different layers are bound to
    happen in a large-scale CoT system, where the devices can be mobile. This
    paper presents a programming language and system for a three-layered CoT
    system. We illustrate how our language and system addresses some of the key
    challenges in the three-layered CoT. A proof-of-concept prototype compiler
    and runtime have been implemented and several example applications are
    developed using it.

    

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
