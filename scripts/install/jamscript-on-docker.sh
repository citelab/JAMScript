#!/usr/bin/env sh

# Make /usr/lib/node_modules writeable

sudo chmod o+w  /usr/lib/node_modules
sudo chmod o+w /usr/bin
sudo chmod o+w /usr/share
sudo chmod o+w /usr/lib


echo "========= Installing JAMScript ======"
# Install JAMScript compiler
sudo npm -g install


sudo chmod o-w /usr/lib/node_modules
sudo chmod o-w /usr/bin
sudo chmod o-w /usr/share
sudo chmod o-w /usr/lib


# Install latest Node
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt-get install -y nodejs
