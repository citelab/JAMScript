---
layout: page
title: Install
subtitle: Installing JAMScript on Linux
---

## Preliminary Setup

Ensure you have the latest Node.js (> 8.0.0) and npm (> 5.0.0) installed on your system.
If you have an older versions, you need to remove them. Here is the command to install Node.js
version 13.x.

```shell
curl -sL https://deb.nodesource.com/setup_13.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## Fixing Permission Issues
If the NPM global install directory is not writable the install will fail with an EACCES error.
NPM can be configured to use a folder inside of your home folder for global installs as follows:
```shell
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
```

You need to include the location of the binary files in your path to use the JAMScript compiler. 
Insert the following line in your `~/.profile` file. 
```shell
export PATH=~/.npm-global/bin:$PATH
```
You need to reload the `~/.profile` using the following command afterwards. 
```shell
source ~/.profile
```

## Installing JAMScript

The JAMScript source is in a single repository.
The tools and samples are inside the main repository under the `tools/` and `tests/` folders, respectively. 
To get the full source, run the following command from the folder where you want JAMScript downloaded.

```shell
git clone https://github.com/citelab/JAMScript
```  
This should create a *JAMScript* folder. 
Go into that folder and  execute the following command to do a local install. If you are going to study
JAMScript, this is the best way to install it. You can change the source and modify various components 
of the compiler and language runtime.
```shell
npm run link
```

After successful installation, you should see the JAMScript compiler in your path: run `which jamc` to see it.
The `tests/` folder has many example files. You can compile them and run them. 

## Environment Setup

The current JAMScript runtime needs many file handlers to function. You need to set a high limit for the
number of allowed file handles before running a JAMScript executable. 
```shell
ulimit -n 3000
```
