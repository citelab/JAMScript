---
layout: page
title: Get Source
subtitle: Get the latest JAMScript Compiler, Tools, and Samples
---

The JAMScript source is in three repositories: JAMScript, JAMTools, and JAMSamples.
The tools and samples are linked as submodules under the main repository (JAMScript). You could get them as
one package or as three separate packages.

Run the following command from the folder where you want JAMScript downloaded.

```shell
git clone --recursive https://github.com/citelab/JAMScript
```  
This should create a *JAMScript* folder there.

Run the following commands to update the submodules that are embedded in the JAMScript
repository.

```shell
cd JAMScript
cd tools
git checkout master && git pull
cd ../samples
git checkout master && git pull
```  
You should have the most up-to-date JAMScript source package in the JAMScript folder.

If you want to download the JAMTools as a separate package, run the following command.

```shell
git clone https://github.com/citelab/JAMTools
```

Same way if you want to download the JAMSamples as a separate package, run the following command.

```shell
git clone https://github.com/citelab/JAMSamples
```
