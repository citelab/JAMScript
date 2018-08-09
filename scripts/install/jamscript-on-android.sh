#!/usr/bin/env sh

# Store the script home.. where the "jamscript-on-android.sh was located
scriptdir=$(dirname -- $(readlink -fn -- "$0"))

# Make /usr/lib/node_modules writeable

sudo chmod o+w /usr/lib/node_modules
sudo chmod o+w /usr/bin
sudo chmod o+w /usr/local/share

sudo chmod o+w /usr/local/lib/node_modules
sudo chmod o+w /usr/local/bin




# Install the libtask
cd deps/libtask
make clean
make
sudo make install
cd ../mujs2
make
sudo make install
cd ../paho
make
sudo make install
cd ../..

sudo chmod o+w /usr/local/lib
# Install JAMScript compiler
sudo npm -g install

cd ~
# Install the other modules
npm install scriptdir/lib/flow
rm package-lock.json
npm install scriptdir/lib/jamserver
rm package-lock.json
npm install scriptdir/lib/jdiscovery
rm package-lock.json

# Reset permissions

sudo chmod o-w /usr/lib/node_modules
sudo chmod o-w /usr/bin
sudo chmod o-w /usr/local/share
sudo chmod o-w /usr/local/lib

sudo chmod o-w /usr/local/lib/node_modules
sudo chmod o-w /usr/local/bin
