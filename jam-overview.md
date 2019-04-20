---
layout: page
title: Overview
subtitle: A High-Level Description of the JAMScript Concepts
---

## The Controller-Worker Model

JAMScript is based on a **controller-worker** model. The controllers
can be at different levels: cloud, fog, and device levels. The workers can
*only* be in the device level. A controller at the device level can have one or
more workers underneath it. Similarly, a controller at the cloud or fog levels can have
more or sub controllers in the lower levels underneath it. Those sub controllers can have
workers provided the sub controller is in the device level.
A worker has exactly one parent controller that is located in the device level.
In addition, the worker would be optionally connected to a controller at the fog level and
cloud level depending on the system configuration. The controller-worker relationship is
*symmetric* in that a worker that is underneath a controller also sees that controller as its
parent.  

The figure below shows how a controller and three workers would be organized
in a single device. In this example, all workers are under the controller in the device.
The device is self-contained -- that is, the JAMScript program loaded into the device
can run even if the device is offline.
<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig4.png" width="350" />
</p>

<!---
    Explain the multi-level configurations
-->

The following figure shows a larger configuration with controllers at the cloud, fog, and
device levels. The workers are at the device level.
A JAMScript program creates a hierarchical configuration when it is run across multiple
devices as shown here.
<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig5.png" width="650" />
</p>

The JAMScript runtime is responsible for creating the hierarchical configuration
among the controllers and workers and different levels. Therefore, JAMScript is highly
suitable for creating and maintaining computing structures across collection of
nodes that are constantly changing in proximity to one another -- for example,
vehicular networks.

In JAMScript, the controller is implemented in JavaScript with few JAMScript specific
extensions. The worker is implemented in C with few JAMScript specific extensions.
The JAMScript specific extensions allow the JAMScript compiler to related both sides
and make the necessary connections between the controller and worker so that both sides
would work as a whole.


## Anatomy of a JAMScript Program

A JAMScript program needs to have a C file and a JavaScript file. The JavaScript (J)
file of a toy JAMScript program is shown below. The J side of the
program is calling a function *testme()* every 300 milliseconds. You will notice that
*testme()* is not defined in the J side. So, it must be defined in the C side of the
JAMScript program as a *remote* function (that is, as a function that can be called
from the J side).
<p align="center">
<img src="{{ site.baseurl }}/images/lang/seg1.png" width="350" />
</p>


The C file of the toy JAMScript program is shown below.
The *testme()* function is defined in the file along with two other functions.
The *testme()* function is prepended with the **jasync** keyword, which indicates
that the function is an asynchronous JAMScript task. An asynchronous JAMScript task
can be invoked from either side: J side or C side. In this case, the *testme()*
is called from the J side.

The *localme()* and *localyou()* are also asynchronous JAMScript tasks, but
they are not called from the J side. Instead they are called from the C side itself.
Once a JAMScript task is defined it could be called from the local worker or the controller.

Asynchronous JAMScript tasks are run using user-level threads. So, they cannot include
any blocking calls like *sleep()*. You will notice that *jsleep()* is used to delay
the execution of the JAMScript task by the given amount of time.
<p align="center">
<img src="{{ site.baseurl }}/images/lang/seg2.png" width="550" />
</p>

The *main()* function launches both JAMScript (local) tasks. The local tasks run concurrently.
Because we are using user-level threading in JAMScript, the *jsleep()* is essential for
yielding the execution context to the other concurrently running threads.

## Auto Discovery in JAMScript Programs

One of the interesting aspects of JAMScript is the auto discovery of JAMScript program
components. A JAMScript executable can be run in
different ways: (a) only in a single device, (b) in a single fog and many devices, and
(c) cloud, fog, and devices. There is no special configuration file to indicate which
configuration is used at any invocation.

Suppose we start a JAMScript program in a device and then in another device.
The JAMScript programs in the two devices would run independent of each other -- that is, without
connecting with one another.
Now, if we start a fog instance, all three instances would get connected -- automatically!
To enable the auto discovery feature, all the JAMScript program instances must be
using the same name.

Consider an example JAMScript program where the worker is creating some data and
pushing it towards the controllers. A worker could have one to three parent
controllers depending on the configuration we use. That is, a worker could have
a device level, device and fog level, or device, fog, and cloud level
controllers.

The program shown below is the C side of the JAMScript application for logging data.
It selects a data string from the 10 available names and logs it to the controller. To
*log* it essentially assigns the local variable (in this case it is *buf*) to *name*.
You can note that *name* is not defined in the C side.
The *main()* function of the program just starts the *logdata()* local task, which is
responsible for pushing one data item every 1000 milliseconds.
<p align="center">
<img src="{{ site.baseurl }}/images/lang/seg3.png" width="650" />
</p>

The J side of the JAMScript application is shown below. The first thing you will note is the
*jdata* section. It defines *name* as a string *logger*. 

<p align="center">
<img src="{{ site.baseurl }}/images/lang/seg4.png" width="550" />
</p>




A little bit more complex




The program
running in the components can initiate a call from the controller to worker
or from the worker to the controller.






The JAMScript language itself is a polyglot
language that incorporates the


  with two different languages. We use JavaScript (J) to write
the controller part and C to write the worker part.

is written for the controller and
worker. The compiler is responsible for splitting the program


## Different Ways of Running JAMScript


## A Peek Under the Hood



<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig1.jpeg" width="500" />
</p>


<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig2.jpeg" width="450" />
</p>



<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig3.jpeg" width="550" />
</p>

##
