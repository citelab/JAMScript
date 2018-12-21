#!/usr/bin/env bash

# Check for Ubuntu OS..
if !([ -e /etc/lsb-release ] &&
	cat /etc/lsb-release | grep "Ubuntu" >/dev/null); then
	   echo "This script runs only in Ubuntu..."
	      exit
      fi

# Store the script home.. where the "depend-install-ubuntu.sh was located
scriptdir=$(dirname -- $(readlink -fn -- "$0"))

sudo apt-get update
sudo apt-get install -y curl
# Install latest Node
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash -
sudo apt-get install -y nodejs

cd
echo "export NODE_PATH=\$HOME/node_modules:/usr/lib/node_modules:\$NODE_PATH" >> .bashrc
source .bashrc
cd $scriptdir

# Create a temp directory
mkdir temp_install_src
cd temp_install_src

# Install some packages..
sudo apt-get install -y iproute2
sudo apt-get install -y net-tools
sudo apt-get install -y iputils-ping
sudo apt install -y inotify-tools

echo
echo
echo "All done!"
echo "Remember to erase the temp_install_src folder!"
echo
echo
