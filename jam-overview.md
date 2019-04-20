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


A JAMScript program needs to have a C file and a JavaScript file. The JavaScript (J)
file of a toy JAMScript program is shown below. The J side of the
program is calling a function *testme()* every 300 milliseconds. You will notice that
*testme()* is not defined in the J side. So, it must be defined in the C side of the
JAMScript program as a *remote* function (that is, as a function that can be called
from the J side).
<p align="center">
<img src="{{ site.baseurl }}/images/lang/seg2.png" width="450" />
</p>



## Auto Discovery in JAMScript Programs





 and workers


situated in different levels.
A **controller** can have one
or more **workers** underneath it.


 similar to the one that
underpins popular paradigms such as [Software Defined
Networking](https://en.wikipedia.org/wiki/Software-defined_networking). The
*controller* and *worker* are co-programmed. That is, a single program is
developed for the controller and worker combination. In JAMScript, the
controller portion of the program is written in JavaScript and the worker
portion of the program is written in C.

In the simplest scenario, we can have a single controller and a single worker.
To run a JAMScript program we need to instantiate both components: controller
worker. The controller can call the worker or the worker can initiate calls on
the controller. Quite easily, we can generalize this setup to include multiple
workers.


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
