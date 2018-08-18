#!/usr/bin/env bash

# Store the script home.. where the "depend.sh was located
scriptdir=$(dirname -- $(readlink -fn -- "$0"))

# Create a temp directory
mkdir temp_install_src
cd temp_install_src

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    sudo apt-get update
    sudo apt-get install -y xz-utils
    sudo apt-get install -y texinfo
    sudo apt-get install -y libc-dev
    sudo apt-get install -y libhiredis-dev
    sudo apt-get install -y libevent-dev
    sudo apt-get install -y libbsd-dev
    sudo apt-get install -y libavahi-compat-libdnssd-dev
    sudo apt-get install -y libssl-dev
    sudo apt install -y clang
    sudo apt-get install -y g++
    sudo apt-get install -y cmake
    sudo apt-get install -y mosquitto
    sudo apt-get install -y mosquitto-clients
    sudo apt-get install -y tmux

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
        cmake --build .
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
elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install mosquitto
    brew install cmake
    brew install tmux
    brew install nanomsg
    brew install redis
    brew tap pjk/libcbor
    brew install libcbor
else
    echo "Unsupported OS"
        exit
fi


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
npm install redis

cd $scriptdir
# install the following here..
npm install ohm-js


rm -rf temp_install_src
