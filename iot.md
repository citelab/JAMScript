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


## Preliminary Setup

Ensure you have the latest Node.js (> 8.0.0) and npm (> 5.0.0) installed on your system.
If you have an older versions, you need to remove them.
We recommend using NVM for installing Node:

```shell
touch ~/.bash_profile
wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
source ~/.nvm/nvm.sh
nvm install node
```


## Installing JAMScript

```shell
npm install -g jamscript
```

After successful installation, you should see the JAMScript compiler in your path: run `which jamc` to see it.

## Fixing Permssions Issues
If the NPM global install directory is not writable the install will fail with an EACCES error.
NPM can be configured to use a folder inside of your home folder for global installs:

```shell
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo "export PATH=~/.npm-global/bin:$PATH" >> ~/.profile
source ~/.profile
```
