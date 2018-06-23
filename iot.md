---
layout: page
title: Install
subtitle: Installing JAMScript on Embedded Computers
---

## Overall Goal

JAMScript has a C part and J (JavaScript) part. The goal of the dual part architecture is to
map the C parts to the extreme peripheries of computing such as tiny micro-controllers
in smart clothing. Currently, however, the C node implemented using messaging libraries that
are not lightweight enough to map into tiny micro-controllers.

We would like to *get help in stripping down middleware* to a smaller footprint
(with correspondingly less features) so that
the compiler can use it for tiny micro-controllers.

## Current Status

JAMScript can run in its current version in Raspberry Pi 3 and Raspberry Zero.

Copy depend-rpi.sh and jamscript-on-ubuntu.sh from scripts/install into the
root folder of JAMScript, then run the following commands:  

```shell
./depend-rpi.sh
./jamscript-on-ubuntu.sh
```
