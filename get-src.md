---
layout: page
title: Get Source
subtitle: Get the latest JAMScript Compiler, Tools, and Samples
---

The JAMScript source is in three repositories: JAMScript-beta, JAMTools, and JAMSamples.
The tools and samples are linked as submodules under the main repository (JAMScript-beta). You could get them as
one package or as three separate packages.

Run the following command from the folder where you want JAMScript downloaded.

```shell
git clone --recursive https://github.com/anrl/JAMScript-beta
```  
This should create a *JAMScript-beta* folder there.

Run the following commands to update the submodules that are embedded in the JAMScript-beta
repository.

```shell
cd JAMScript-beta
cd tools
git checkout master && git pull
cd ../samples
git checkout master && git pull
```  
You should have the most up-to-date JAMScript source package in the JAMScript-beta folder.

If you want to download the JAMTools as a separate package, run the following command.

```shell
git clone https://github.com/anrl/JAMTools
```

Same way if you want to download the JAMSamples as a separate package, run the following command.

```shell
git clone https://github.com/anrl/JAMSamples
```
