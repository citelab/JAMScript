---
layout: page
title: Install
subtitle: Installing JAMScript on MacOS
---

## Preparing your system

We will use the [homebrew package manager](http://brew.sh) to install the prequisites of JAMScript. Once homebrew is installed run the following commands:


```shell
brew install scons
brew install node
brew install redis
brew install hiredis
brew install libcbor
brew install nanomsg
```


## Installing JAMScript

```shell
cd (jamscript folder)
sudo scons install
```