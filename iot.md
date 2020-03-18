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

We are targetting [mBed OS](https://www.mbed.com/en/platform/mbed-os/) and/or [Zephyr OS](https://www.zephyrproject.org) as part of this goal. We welcome your contributions towards 
achieving this goal.

You can run JAMScript in Raspberry Pi (Zero included) using the instructions in the ''Linux'' section.

