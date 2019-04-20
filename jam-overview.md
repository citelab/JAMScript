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

The figure below shows a configuration in a single device that runs three workers and one
controller. All the workers are under the controller running in the device.
By mapping the controllers and workers into a device, the device would have all the components
to fully execute the JAMScript program. That is, the JAMScript program would be disconnection
tolerant.
<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig4.png" width="350" />
</p>

<!---
    Explain the multi-level configurations
-->

<p align="center">
<img src="{{ site.baseurl }}/images/lang/fig5.png" width="650" />
</p>





## Auto Discovery in JAMScript Programs


## Anatomy of a JAMScript Program


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
