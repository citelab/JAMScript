---
layout: page
title: Install
subtitle: Installing JAMScript on Linux
---

## Preparing your system (Ubuntu)    

Using the Ubuntu package manager install the following packages.

```shell
sudo apt-get install xz-utils
sudo apt-get install texinfo
sudo apt-get install libc-dev
sudo apt-get install cmake
sudo apt-get install libhiredis-dev
sudo apt-get install libevent-dev
sudo apt-get install libbsd-dev
sudo apt-get install g++
```

Unfortunately, Ubuntu package distribution does not have the latest version for
all required software. So we need to install them manually.

scons version 2.5 or later is best. Following commands can be used to install
scons.

```shell
cd /tmp or a download directory
wget http://prdownloads.sourceforge.net/scons/scons-2.5.0.tar.gz
tar zxvf scons-2.5.0.tar.gz
cd scons-2.5.0
sudo python setup.py install
```

Check your node version. If you have a node that is 6.3.1 or later you can skip this
step. Here are the instructions for Node 6.5.0.

```shell
wget https://nodejs.org/dist/v6.5.0/node-v6.5.0-linux-x64.tar.xz
sudo tar -C /usr/local --strip-components 1 -xJf node-v6.5.0-linux-x64.tar.xz
```
You should have the NodeJS and NPM installed now.

Check whether your system has gcc 5 or newer. If not, you need to upgrade it
using the following commands.

```shell
sudo add-apt-repository ppa:ubuntu-toolchain-r/test
sudo apt-get update
sudo apt-get install gcc-5 g++-5

sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-5 1
```

Libcbor needs to be installed; use the following commands.

```shell
wget https://github.com/PJK/libcbor/releases/download/v0.4.0/libcbor-0.4.0-Linux.deb
sudo dpkg -i libcbor-0.4.0-Linux.deb
```

Install nanomsg using the following commands.

```shell
wget https://github.com/nanomsg/nanomsg/archive/1.0.0.tar.gz
tar zxvf 1.0.0.tar.gz
cd nanomsg-1.0.0
./configure
make
sudo make install
```

The JAMScript source has a slightly modified task library in the deps folder.
Run the following commands to install it.

```shell
cd deps/libtask
make
sudo make install
```

Now, you should have a system that can run the JAMScript compiler.


## Preparing your Raspberry Pi

Not yet tested. It is best to cross compile JAMScript to Raspberry Pi although
RPI3 is powerful enough to compile JAMScript.

## Preparing your Arduino Yun

Definitely need a JAMScript cross compiler.
Need testing and documentation.

## Installing JAMScript

If everything is done according the previous instructions to prepare the system,
installing JAMScript is very simple; run the following commands.

```shell
cd into the JAMScript source directory
scons
sudo scons install
```

Now, you should have the JAMScript compiler installed in the system. To verify whether
`jamc` got installed, run `which jamc`.