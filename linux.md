---
layout: page
title: Install
subtitle: Installing JAMScript on Linux
---

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
export PATH=~/.npm-global/bin:$PATH
source ~/.profile
```
