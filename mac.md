---
layout: page
title: Install
subtitle: Installing JAMScript on MacOS
---

## Preliminary Setup

Homebrew is required for installating JAMScript:
```shell
/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

Ensure you have the latest Node.js (> 8.0.0) and npm (> 5.0.0) installed on your system.
We recommend using Homebrew for installing the latest version of Node:
```shell
brew install node
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
