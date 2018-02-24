---
layout: page
title: Install
subtitle: Docker and JAMScript
---

## Packaging JAMScript in Docker Containers

JAMScript is already packaged in Docker containers. You can use them following the instructions [here](../emulator-run).

Here, we describe how JAMScript can be repackaged in Docker containers. You need to do this if the current container
does not have a latest feature that is required by your application.




This step assumes you have already downloaded the JAMScript source following the instructions [here](../get-src).

Ensure you have the latest Node.js (> 8.0.0) and npm (> 5.0.0) installed on your system.
If you older versions, you need to manually remove them.
If you have multiple Node versions or Node version manager (NVM) installed, you can
encounter problems **not documented here**. In that case, you need to watch out where the install scripts fail
and take remedial actions.

Include JAMTools in the path. If you are using BASH as the shell, include the following in `.bash_profile`.
```shell
export JAMHOME=$HOME/JAMScript-beta
# This is assuming you have downloaded JAMScript in your home directory
export PATH=$JAMHOME/tools:$PATH
# Assumes you did not download JAMTools into a separate folder
```  

If you logout and login again or `src .bash_profile` the settings should take effect. You should see the JAMTools
in your path. To test, run `which jamrun` and you should see the location printed out. Same way check the JAMHOME
points to the correct location by running `cd $JAMHOME`.

## Installing JAMScript

We have tried to automate the installation of JAMScript. It is still a work-in-progress (as the rest!). Your feedback or help
is important to fix the problems. You should be able to install JAMScript by issuing the following command from any where
in the file system after completing the preliminary setup.

```shell
jam install ubuntu
```

After successful installation, you should see the JAMScript compiler in your path: run `which jamc` to see it.
Unfortunately, at this point, we don't have a test or validation suite for JAMScript installs, you can go into the
samples (`cd $JAMHOME/samples`) and try running them to make sure JAMScript install has succeeded.

*Ubuntu* is the only Linux distribution currently supported by the installation scripts. However, JAMScript should run in
any Linux distribution if manually installed.
