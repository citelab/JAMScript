---
layout: page
title: Install
subtitle: Docker and JAMScript
---


## Preliminary Steps

You need to get the *tools* to run the emulator. Follow the instructions in [Get
Source](../get-src) to download the tools. You will see many **jam-x** and **djam-x** programs
in the tools folder. Make them available for execution by including the tools folder in your
path. At least the **djam** tools should be available to proceed with the Docker-based
execution.

Any Docker-based JAMScript execution (even if it is a single node) requires the
configuration of a network topology. To configure the network topology, [Pumba
Chaos Testing Tool](https://github.com/alexei-led/pumba/releases) is required. From the
above link, you need to download the appropriate executable for your OS.

The next step is to make Docker containers run without `sudo`. Find the sequence of steps
necessary for your Linux distribution or MacOS by searching the Internet. Test that you
actually succeeded in configuring Docker containers to run
without `sudo` by using
a command like `docker ps` and observing the outcome. You won't be able to continue the
experiments **without completing** this step.

## Getting a Docker Image with JAMScript

Assuming that you have the *tools* (JAMTools) in your path, you can use `djam
pull mahes25/jamscript` to get a Docker image with JAMScript. If you have an
alternate image, you can pull that one by substituting it for
`mahes25/jamscript` in the above command.

After this step, you have a Docker image with JAMScript. Follow the
instructions in [Emulator Run](../emulator-run) to carry out the experiments using
this Docker image.

## Packaging JAMScript in Docker Containers

If you have added a feature to the JAMScript language runtime or compiler and
want to have that in the Docker version, you need to repackage the container
images. You can share your container image with others using a public Docker
image repository.

The JAMScript source package has a `Dockerfile` necessary for rebuilding the docker image.
`cd $JAMHOME/scripts/install` to see the `Dockerfile`. You can edit it if you want to make changes.
Run the following command from there to rebuild a container image. The `Dockerfile` is
configured to use the files from the repository at [https://github.com/anrl/JAMScript-beta](https://github.com/anrl/JAMScript-beta). Therefore, if you
need any additions to the rebuilt image, those additions should be committed to the above repository or
the `Dockerfile` needs to be edited to use another location for the source files.
```shell
docker build --no-cache -t jamscript .
```
After the build is completed, you can push the image to a remote repository like
the following.
```shell
docker tag jamscript docker_hub_user/jamscript
docker push docker_hub_user/jamscript
```
