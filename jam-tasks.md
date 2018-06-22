---
layout: page
title: Tasks
subtitle: Local and Remote Tasks in JAMScript
---

## Tasks in JAMScript Programs

A JAMScript program has C and JavaScript functions with some of them prepended with
the **jasync** or **jsync** keywords. In this section, we refer to such tagged functions
as *JAMScript tasks*. A JAMScript task runs in a single node; that is, a given task is not distributed
across multiple nodes. A task is considered **local** if it runs in the same node as the invoking function
while the tasks running in a different node are considered **remote**.

We have local tasks in the worker (C) side as well as the controller
(J) side. The remote tasks are in between C and J node.
For the time being, we will ignore multiple (hierarchically organized) controllers.
The C nodes can invoke remote tasks only on J nodes.
<p align="center">
<img src="{{ site.baseurl }}/images/lang_tasks/fig1.jpeg" width="300" />
</p>

Different C nodes are not connected
to each other.


## Defining and Using Local Tasks


## Defining and Using Remote Tasks


## Synchronous Tasks and Returning Values


## Chaining Asynchronous Task Executions via Callbacks
