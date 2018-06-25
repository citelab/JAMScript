---
layout: page
title: Data Persistence
subtitle: Logging and Broadcasting Data in JAMScript
---

## Overview of Data Management

In JAMScript, nodes are independent (i.e., have separate address spaces). All
data processing that happens in a node are local to that node. From what we have
seen so far, only way of exchanging data between nodes is to use *parameter
passing* (i.e., message passing implemented via remote task invocations).

In edge-oriented IoT, devices can push data at high rate towards the edge for
processing. The edge computers (i.e., fogs) process the data before passing it
to the cloud. We need another mechanism besides the parameter passing to
exchange such high rate data. JAMScript introduces **logger** as the key
mechanism  for pushing data from the devices to the fogs and from the fogs to
the cloud.  The diagram below illustrates a simple scenario that could happen
within a single device. We have a controller and many workers in this scenario.
The workers produce the data and push it towards the controller. The logger
structure organizes the data into streams. There is one stream corresponding to
each worker. We can **slice** the stream at any given instance to get an array
of data for analysis.

<p align="center"> <img src="{{ site.baseurl }}/images/lang_jdata/fig1.jpeg" width="500" /> </p>

The diagram below shows a scenario where data logging happens from the device to fogs.
Still the bulk of the data is produced by workers attached to the devices. The data is funneled
through the controllers at the device towards the controller at the fog level.
The device-level controller could transform the data or add its own data stream as
the data propagates upwards.

<p align="center"> <img src="{{ site.baseurl }}/images/lang_jdata/fig2.jpeg" width="580" /> </p>


## Logging Data

The logger that streams the data from the worker towards the controllers at the different levels
is defined using a special `jdata` section in the J side of a JAMScript program as follows.

```C
jdata {
    char *q as logger;
    int y as logger;
    struct location {
        float long;
        float lat;
    } loc as logger;
}
```

In the above definition, `q` is a string logger (i.e., stream of strings with
variable length), `y` is a stream of integers, and `loc` is stream of
structures, where each structure contains two floats. The logger is an append
only stream for the worker. That is the worker cannot read the logger. The
controllers can read the logger and obtain values at different positions of the
stream. For instance, the controller can get values by arrival time or by
position (last, first, etc) in the stream.





## Broadcasting Data
