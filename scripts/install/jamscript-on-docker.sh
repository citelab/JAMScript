#!/usr/bin/env sh

# Make /usr/lib/node_modules writeable

sudo chmod o+w  /usr/lib/node_modules
sudo chmod o+w /usr/bin
sudo chmod o+w /usr/share
sudo chmod o+w /usr/lib


echo "========= Installing JAMScript ======"
# Install JAMScript compiler
sudo npm -g install jamscript


sudo chmod o-w /usr/lib/node_modules
sudo chmod o-w /usr/bin
sudo chmod o-w /usr/share
sudo chmod o-w /usr/lib
