---
layout: page
title: Overview
subtitle: A High-Level Description of the JAMScript Concepts
---

## Anatomy of a JAMScript Program

JAMScript is based on a **controller-worker** model similar to the one that
underpins recent paradigms such as (Software Defined
Networking)[https://en.wikipedia.org/wiki/Software-defined_networking]. The
*controller* and *worker* are co-programmed. That is, a single program is
developed for the controller and worker combination. In JAMScript, the
controller portion of the program is written in JavaScript and the worker
portion of the program is written in C.

In the simplest scenario, we can have a single controller and a single worker.
To run a JAMScript program we need to instantiate both components: controller
worker. The controller can call the worker or the worker can initiate calls on
the controller. Quite easily, we can generalize this setup to include multiple workers.


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


##
