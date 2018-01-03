#!/usr/bin/env sh

# Make /usr/lib/node_modules writeable

sudo chmod o+w  /usr/local/lib/node_modules
sudo chmod o+w /usr/bin
sudo chmod o+w /usr/local/share
sudo chmod o+w /usr/local/lib


# Install the libtask
cd deps/libtask
make clean
make
sudo make install
cd ../mujs2
make
sudo make install
cd ../..

# Install JAMScript compiler
npm -g --unsafe-perm install

# Install the other modules
npm install -g lib/flow
npm install -g lib/jamserver
npm install -g lib/jdiscovery

# Reset permissions

sudo chmod o-w /usr/local/lib/node_modules
sudo chmod o-w /usr/bin
sudo chmod o-w /usr/local/share
sudo chmod o-w /usr/local/lib

# This is a hack!
cd /JAMScript-beta/lib/jamserver
# There should not be a node_modules directory here
rm -rf node_modules
