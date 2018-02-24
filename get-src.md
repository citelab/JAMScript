---
layout: page
title: Get Source
subtitle: Get the latest JAMScript Compiler, Tools, and Samples
---

The JAMScript source package is in three repositories: JAMScript-beta, JAMTools, and JAMSamples.
The tools and samples are linked as submodules under the main repository. You could get them as
one package of as three packages.

Run the following command from the folder where you want to download JAMScript source.
```shell
git clone --recursive https://github.com/anrl/JAMScript-beta
```  
This should create a *JAMScript-beta* folder in the directory where the command was run.

Run the following commands to update the submodules that are embedded in the JAMScript-beta
repository.
```shell
cd JAMScript-beta
cd tools
git checkout master && git pull
cd ../samples
git checkout master && git pull
```  
The most up-to-date JAMScript source package should be under the JAMScript-beta folder at this point.

If you want to download the JAMTools as separate package, run the following command.
```shell
git clone https://github.com/anrl/JAMTools
```

If you want to download the JAMSamples as separate package, run the following command.
```shell
git clone https://github.com/anrl/JAMSamples
```
