#!/usr/bin/env bash

if [  $(npm -v | cut -d. -f1) -lt "6" ]
then
        echo "npm version older than 6.0.0"
        exit 1
fi

# Create a temp directory
sudo mkdir temp_install_src
sudo chmod o+w temp_install_src
cd temp_install_src


if [[ "$OSTYPE" == "linux-gnu"* ]]; then
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
        cd ../..
    fi

    # CBOR
    qres=$(dpkg -s libcbor 2>/dev/null | grep "Status" | tr -d ' ')
    if [ -z $qres ]; then
        wget https://github.com/PJK/libcbor/archive/v0.5.0.zip
        unzip v0.5.0.zip
        cd libcbor-0.5.0
        cmake CMakeLists.txt
        make
        sudo make install
        cd ..
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
        cd ..
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew install mosquitto
    brew install cmake
    brew install tmux
    brew install hiredis
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
    exit 1
fi

cd ..


cd deps/mujs2
make
sudo make install
cd ../paho
make
sudo make install
cd ..

sudo rm -rf temp_install_src
