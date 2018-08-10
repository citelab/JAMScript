---
layout: page
title: Install
subtitle: Installing JAMScript on MacOS
---

## Preliminary Setup

This step assumes you have already downloaded the JAMScript source following the instructions [here](../get-src).

Ensure you have the latest Node.js (> 8.0.0) and npm (> 5.0.0) installed on your system.
If you older versions, you need to manually remove them.
If you have multiple Node versions or Node version manager (NVM) installed, you can
encounter problems **not documented here**. In that case, you need to watch out where the install scripts fail
and take remedial actions.

Include JAMTools in the path. If you are using BASH (default in MacOS) as the shell, include the following in `.bash_profile`.

```shell
export JAMHOME=$HOME/JAMScript
# This is assuming you have downloaded JAMScript in your home directory
export PATH=$JAMHOME/tools:$PATH
# Assumes you did not download JAMTools into a separate folder
```  

If you logout and login again or `src .bash_profile` the settings should take effect. You should see the JAMTools
in your path. To test, run `which jamrun` and you should see the location printed out. Same way check the JAMHOME
points to the correct location by running `cd $JAMHOME`.

We will use the [Homebrew package manager](http://brew.sh) to install JAMScript. Install Homebrew before continuing with the rest
of the instructions.

## Installing JAMScript

We have tried to automate the installation of JAMScript. It is still a work-in-progress (as the rest!). Your feedback or help
is important to fix the problems. You should be able to install JAMScript by issuing the following command from any where
in the file system after completing the preliminary setup.

```shell
jam install macos
```

After successful installation, you should see the JAMScript compiler in your path: run `which jamc` to see it.
Unfortunately, at this point, we don't have a test or validation suite for JAMScript installs, you can go into the
samples (`cd $JAMHOME/samples`) and try running them to make sure JAMScript install has succeeded.
