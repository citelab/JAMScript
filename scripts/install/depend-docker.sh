#!/usr/bin/env bash

# Check for Ubuntu OS..
if !([ -e /etc/lsb-release ] &&
	cat /etc/lsb-release | grep "Ubuntu" >/dev/null); then
	   echo "This script runs only in Ubuntu..."
	      exit
      fi

# Store the script home.. where the "depend-install-ubuntu.sh was located
scriptdir=$(dirname -- $(readlink -fn -- "$0"))   


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
sudo apt-get install -y libavahi-compat-libdnssd-dev

# Check and install..
if (command -v clang > /dev/null); then
    echo "clang already installed.. skipping install"
else
    sudo apt install -y clang
fi

if (command -v g++ > /dev/null); then
    echo "g++ already installed.."
else
    sudo apt-get install -y g++
fi

if (command -v cmake > /dev/null); then
    echo "cmake already installed.."
else
    sudo apt-get install -y cmake
fi

if (command -v mosquitto > /dev/null); then
    echo "mosquitto already installed.."
else
    sudo apt-get install -y mosquitto
fi

if (command -v mosquitto_pub > /dev/null); then
    echo "mosquitto_pub already installed.."
else
    sudo apt-get install -y mosquitto-clients
fi

if (command -v tmux > /dev/null); then
    echo "terminal multiplexor already installed.."
else
    sudo apt-get install -y tmux    
fi

# Install latest Node
if (command -v node > /dev/null); then
    echo "node already installed.."
else
    sudo apt-get install -y python-software-properties
    wget https://nodejs.org/dist/v8.2.1/node-v8.2.1-linux-x64.tar.xz
    sudo tar -C /usr/local --strip-components 1 -xJf node-v8.2.1-linux-x64.tar.xz
fi

cd
echo "export NODE_PATH=\$HOME/node_modules:/usr/local/lib/node_modules:\$NODE_PATH" >> .bashrc
source .bashrc
cd $scriptdir
cd temp_install_src



# NANOMSG
if (command -v nanocat > /dev/null); then
    echo "nanomsg already installed.."
else
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
qres=$(dpkg -s libcbor 2>/dev/null | grep "Status" | tr -d ' ')
if [ -z $qres ]; then
    wget https://github.com/PJK/libcbor/releases/download/v0.4.0/libcbor-0.4.0-Linux.deb
    sudo dpkg -i libcbor-0.4.0-Linux.deb
else
    echo "libcbor already installed..."
fi


# MQTT
qres=$(ldconfig -p | grep mqtt3a | tr -d ' ')
if [ -z $qres ]; then
    sudo apt-get install -y libssl-dev
    git clone https://github.com/eclipse/paho.mqtt.c.git
    cd paho.mqtt.c
    make
    sudo make install
    cd ..
fi


# Redis
if (command -v redis-server > /dev/null); then
    echo "Redis already installed"
else
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



