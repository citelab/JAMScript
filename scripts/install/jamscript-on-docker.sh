#!/usr/bin/env sh

# Make /usr/lib/node_modules writeable

sudo chmod o+w  /usr/local/lib/node_modules
sudo chmod o+w /usr/bin
sudo chmod o+w /usr/local/share
sudo chmod o+w /usr/local/lib


# Install JAMScript compiler
npm -g install jamscript


sudo chmod o-w /usr/local/lib/node_modules
sudo chmod o-w /usr/bin
sudo chmod o-w /usr/local/share
sudo chmod o-w /usr/local/lib
