#!/usr/bin/env sh

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

# CBOR
wget https://github.com/PJK/libcbor/releases/download/v0.4.0/libcbor-0.4.0-Linux.deb
sudo dpkg -i libcbor-0.4.0-Linux.deb

# MQTT
wget "https://www.eclipse.org/downloads/download.php?file=/paho/1.2/eclipse-paho-mqtt-c-unix-1.1.0.tar.gz&r=1" -O mqtt.tar.gz
mkdir mqtt
tar -zxvf mqtt.tar.gz -C mqtt
sudo mv mqtt/include/*.h /usr/local/include

# BSD
sudo apt-get install libbsd-dev

# HIREDIS
sudo apt-get install libhiredis-dev
