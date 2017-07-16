#!/usr/bin/env sh

# Create a temp directory
mkdir temp_install_src
cd temp_install_src

# Install some packages..
sudo apt-get update
sudo apt-get install -y clang
sudo apt-get install -y xz-utils
sudo apt-get install -y texinfo
sudo apt-get install -y libc-dev
sudo apt-get install -y cmake
sudo apt-get install -y libhiredis-dev
sudo apt-get install -y libevent-dev
sudo apt-get install -y libbsd-dev
sudo apt-get install -y mosquitto


# Install latest Node
sudo apt-get install -y python-software-properties
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
sudo apt-get install -y nodejs


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
wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
cd redis-stable
make
sudo make install

cd ..

# Erase all the downloaded files and folders
rm -rf temp_install_src

