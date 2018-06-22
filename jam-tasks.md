---
layout: page
title: Tasks
subtitle: Local and Remote Tasks in JAMScript
---

## Tasks in JAMScript Programs

A JAMScript program has C and JavaScript functions with some of them prepended with
the **jasync** or **jsync** tags. Those tagged functions have special significance
in a JAMScript program. We refer to them as *JAMScript tasks* in this section.
A JAMScript task runs in a single node; that is, a given task is not distributed
across multiple nodes.

A task is considered **local** if it runs in the same node as the invoking function
while the tasks running in a different node are considered **remote**.

In JAMScript, we have local tasks in the worker (C) side as well as the controller
(J) side. The remote tasks are in between C and J node. Different C nodes are not connected
to each other.


## Defining and Using Local Tasks


## Defining and Using Remote Tasks


## Synchronous Tasks and Returning Values


## Chaining Asynchronous Task Executions via Callbacks
