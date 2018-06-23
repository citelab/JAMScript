---
layout: page
title: Conditional Tasks
subtitle: Conditional Execution of Remote Tasks
---

## What are Conditional Tasks?

In JAMScript, controllers broadcast remote task execution requests to the
sub-controllers or workers. Similarly, workers  send remote task execution
requests to the controllers at the different levels.  The conditional execution
is a mechanism to control the remote task executions in a context-sensitive way.
The execution context could be defined based on node type (e.g., device, fog, or
cloud) or values of the *exo-state variables* (e.g., loggers and broadcasters).

For instance, using such a conditional remote execution mechanism a worker can
precisely place its remote execution at a particular level. That is, to benefit
from local contexts, it could ask the execution to remain at the fog level
instead of reaching the  cloud level. Conversely, a worker could request certain
other tasks be executed at the  global context (i.e., at the cloud level).

As another example consider a cloud controller requesting certain devices to run a
given task. The eligibility to execute the task is decided based on data values generated
by the devices. We can setup a conditional to test for the eligibility based on the data
values.






can precisely place its
remote task executions between the different available levels: device, fog, or cloud.


request certain calls for remote task
executions must be run at the cloud instead of the fogs. ensure that its
call to the controller is executed at the cloud-level instea


## How to specify a Condition?

Conditions should always be defined in a **jcond{...}** section on a J-node. Each jcond defination statement can hold multiple JConditionals.

```shell
jcond {
    condName: expression;
}
```
condName: the name of the condition variable.
expression: the corresponding condition expression.

**Example:** creating conditions for choosing activity level.

```shell
jcond {
    cloudonly: sys.type == "cloud";
    // type is a member of the sys object
    fogonly: sys.type == "fog";
    devonly: sys.type == "dev";
}
```
This JConditional defination uses the global system context object `sys` . The global context object `sys` has several attributes that describe the runtime context. The `sys.type` field tells us the `type` of the node at which the program is currently running. And the `type` could be a device, fog, or cloud.

## How to use Condition in Task Invocation?

Suppose we have some JavaScript functions in a JAMScript program that we want to export. The exported function is available for execution at all levels of the hierarchy: device, fog, and cloud. When a call for that function is initiated by the C side, all levels (if the fog and cloud exist) will get the call for execution.

If we want to restrict the execution of the function to a particular level, we need to **prepend the function definition with a condition**. This way the execution only occurs where the condition evaluates to true. In the following example, the function process_at_cloud() runs only at the cloud because it is prepended by the cloudonly condition that is defined above.

**Example:** restrict a function to be executed only at the cloud level.

```shell
// Definition of the function in the J side
jasync {cloudonly} function process_at_cloud() {
    ...
}
// Invocation of the function in the C side
process_at_cloud();
```

## What values can be evaluted by JConditional?

* **Global variables** (e.g., the members of the sys object).  
The global context object **sys** provides many attributes that can be tested as a precondition before a task execution is launched at a node.

**tags** – A node could be characterized by a number of tags that are arbitrarily associated with the node. For instance, a thermostat could have a “temp_sensor” tag associated with it. Using the optional tags field, a JAMScript could specify the tags a node possess before accepting the task. Because a node could have many tags, we use the inclusion test operator to test whether a node has a specific tag. This field can optionally include an array of tags that describe a particular node. To check whether a particular tag is specified, use sys.tags := “temp_sensor” . In this case, the inclusion test operator := is used.

**loyalty** – Loyality is a measure of the likelihood a node would complete the execution of the task. It differs based on the task’s duration and the time of invoking the function. The value specified in this field in the minimum value the node is expected to have before undertaking to run the task. It is a value between 0 and 1.0 and is specified as follows: sys.loyalty == 0.9.

**zone** – The network of nodes over which a JAMScript program runs can be broken down into many zones. Certain applications might want to specify zone-based proximity or non-proximity as a precondition for task execution. For instance, sys.zone == 10 will ensure that the task execution only takes place on nodes that are in zone 10. A hardcoded zone number would not be very useful because the zone numbers cannot be known at programming time. Therefore, the best way of specifying this condition by using a jdata variable controlled by a broadcaster. We can converge all the execution to a particular zone or ensure that the execution is on diverse locations.

**type** – JAMScript runs on three different types of nodes: device, fog, and cloud. Using this field we can specify the node type that is necessary to run a particular task.

* The **sync** object
While the sys object specifies the context that should be satisfied by a single node before the task is launched on it, the sync object specifies the synchronization requirements that should be satisfied before a synchronous task could be launched at a node.

**degree** – Synchronous tasks perform group activities. Using synchronization degree, we can specify the minimum number of nodes that are needed to launch a synchronous task. Unlike the contextual conditions specified using sys , sync provides environmental conditions that should be met. In particular, the size of the peer group of nodes that should be present to run synchronous task.

**confirm** – This is another group condition. While degree specifies the number of nodes that should be present to start the task execution, confirm specifies the fraction of nodes that should complete the task to consider the task execution to be a success.

* The **exec** object
The condition expressed using the exec is object is very different from the other two. This specifies an execution condition that should be met to start the task execution. In particular, the starting delay. The most useful use of this condition is to introduce a random delay to the execution of a group task execution. For instance, by specifying exec.delay := random we can introduce random delays for starting.

* **jdata variables**, i.e, JAMDatasources, in the same program.
By default, when jdata defined parameters are used in expressions, average values are computed for each parameter before the comparison.

**Example:** create a jconditional on a logger

```shell
jdata{
    float x as logger;
}

jcond{
    less: x<22.5;
}
```
Here, we are comparing the average (measured over a window of logged values) to 22.5 and the condition would evaluate to true if the average of the temperature values is smaller than 22.5. The average value used in the condition expression is computed over all the streams at the device, where the condition is evaluated.

Instead of average values other measures such as min, max can be used by specifying them in the expression as follows. The average, min, and max values are computed over a moving window of values of the time series. When multiple streams (i.e., multiple devices) the window spans all available streams.

**Example:** create a jconditional to evaluate the maximum value recorded by a logger

```shell
jdata{
    float x as logger;
}

jcond{
    much_less: max(x)<22.5;
}
```

**Example:** create a jconditional to evaluate the value of a structural logger

```shell
jdata{
    struct temp_reading {
        int tempvalue;
        int xcoord;
        int ycoord;
    } readings as logger;
}

jcond {
    low_temp: avg(readings.tempvalue) < 22.5;
}
```

## Can I use logical operators?

Yes sure. There are two places where we can use logical operators. They can be used either in a jcond{...} section to defined a jconditional variable, or inside an activity declaration to combine two or more jconditional variables.

**Example:**

```shell
jdata {
    float temp as logger(fog);
}

jcond {
    low_dev_temp: sys.type == "dev" && temp < 18.5;
    dev_only: sys.type == “dev”;
    low_temp: temp < 18.5;
}

jasync {low_dev_temp} function fname() {
    // turns on the heater in the room
}

jasync {low_temp && dev_only} function fname2() {
    // turns on the heater in the room
}
```

##
