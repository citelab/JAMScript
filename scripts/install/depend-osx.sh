#!/usr/bin/env bash

# Create a temp directory
mkdir temp_install_src
cd temp_install_src

brew install mosquitto
brew install cmake
brew install tmux

if (command -v node > /dev/null); then
    echo "Node already installed"
else
    brew install node
fi

if (command -v nanocat > /dev/null); then
    echo "Nano message already installed"
else
    brew install nanomsg
fi


if (command -v redis-server > /dev/null); then
    echo "Redis already installed"
else
    brew install redis
fi

brew tap pjk/libcbor
brew install libcbor

git clone https://github.com/eclipse/paho.mqtt.c.git
cd paho.mqtt.c
make
sudo make install
cd ..

echo "Setting up the NPM modules in the user directory..."
echo
cd $HOME
npm install mqtt
npm install command-line-args
npm install random-js
npm install node-localstorage
npm install bunyan
npm install lockfile
npm install cbor
npm install deasync
npm install json-fn
npm install mime

cd $scriptdir
# install the following here..
npm install ohm-js


echo
echo
echo "All done!"
echo "Remember to erase the temp_install_src folder!"
echo
echo


