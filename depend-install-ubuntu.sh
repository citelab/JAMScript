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
if !test clang > /dev/null; then
sudo apt-get install -y clang
fi

if !test g++ > /dev/null; then
sudo apt-get install -y g++
fi

if !test cmake > /dev/null; then
sudo apt-get install -y cmake
fi

if !test mosquitto > /dev/null; then
sudo apt-get install -y mosquitto
fi


# Install latest Node
if !test node > /dev/null; then
sudo apt-get install -y python-software-properties
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs
fi


# NANOMSG
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

cd ../..


# CBOR
wget https://github.com/PJK/libcbor/releases/download/v0.4.0/libcbor-0.4.0-Linux.deb
sudo dpkg -i libcbor-0.4.0-Linux.deb

# MQTT
wget "https://www.eclipse.org/downloads/download.php?file=/paho/1.2/eclipse-paho-mqtt-c-unix-1.1.0.tar.gz&r=1" -O mqtt.tar.gz
mkdir mqtt
tar -zxvf mqtt.tar.gz -C mqtt
sudo mv mqtt/include/*.h /usr/local/include

# Redis
if !test redis-server > /dev/null; then
wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
cd redis-stable
make
sudo make install
fi



echo
echo
echo "All done!"
echo "Remember to erase the temp_install_src folder!"
echo 
echo

