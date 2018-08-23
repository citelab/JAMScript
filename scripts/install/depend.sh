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
    sudo apt-get install -y unzip
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
else
    echo "Unsupported OS"
        exit
fi

cd $scriptdir/../../
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


cd $scriptdir
rm -rf temp_install_src
