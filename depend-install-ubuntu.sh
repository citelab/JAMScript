#!/usr/bin/env sh

# Create a temp directory
mkdir temp_install_src
cd temp_install_src

# Install some packages..
sudo apt-get update
sudo apt-get install -y xz-utils
sudo apt-get install -y texinfo
sudo apt-get install -y libc-dev
sudo apt-get install -y libhiredis-dev
sudo apt-get install -y libevent-dev
sudo apt-get install -y libbsd-dev

# Check and install..
if !type clang > /dev/null; then
sudo apt-get install -y clang
else
   echo "clang already installed.."
fi

if !type g++ > /dev/null; then
sudo apt-get install -y g++
else
   echo "g++ already installed.."

fi

if !type cmake > /dev/null; then
sudo apt-get install -y cmake
else
   echo "cmake already installed.."

fi

if !type mosquitto > /dev/null; then
sudo apt-get install -y mosquitto
else
   echo "mosquitto already installed.."

fi


# Install latest Node
if !type node > /dev/null; then
sudo apt-get install -y python-software-properties
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
else
   echo "node already installed.."

fi


# NANOMSG
if !type nanocat > /dev/null; then
wget https://github.com/nanomsg/nanomsg/archive/1.0.0.tar.gz
tar xvzf 1.0.0.tar.gz
cd nanomsg-1.0.0
mkdir build
cd build
cmake ..
cmake --build
ctest -G Debug
sudo cmake --build . --target install
sudo ldconfig
fi

cd ../..


# CBOR
if (dpkg -s libcbor 1>/dev/null 2>/dev/null); then
wget https://github.com/PJK/libcbor/releases/download/v0.4.0/libcbor-0.4.0-Linux.deb
sudo dpkg -i libcbor-0.4.0-Linux.deb
fi

# MQTT
if ldconfig -p | grep mqtt3a >/dev/null; then
sudo apt-get install -y libssl-dev                                                           
git clone https://github.com/eclipse/paho.mqtt.c.git                                         
cd paho.mqtt.c                                                                               
make                                                                                         
sudo make install                                                                            
cd ..
fi

# Redis
if !type redis-server > /dev/null; then
wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
cd redis-stable
make
sudo make install
fi


echo "Setting up the NPM modules in the user directory..."
echo
cd $HOME
npm install mqtt
npm install command-line-args
npm install random-js
npm install node-localstorage
npm install bunyan




echo
echo
echo "All done!"
echo "Remember to erase the temp_install_src folder!"
echo 
echo



