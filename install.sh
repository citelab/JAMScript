#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

sudo apt update

# install clang if not found
if ! command -v clang &> /dev/null; then 
    echo "Clang not found: installing..."
    sudo apt install -y clang
fi

# install mosquitto clients
if ! command -v mosquitto_pub &> /dev/null; then 
    echo "Mosquitto tools not found: installing..."
    sudo apt install -y mosquitto-clients
    sudo apt install -y mosquitto
fi

# install unzip
if ! command -v unzip &> /dev/null; then 
    echo "Unzip not found: installing..."
    sudo apt install -y unzip
fi

# install redis
if ! command -v redis-cli &> /dev/null; then 
    echo "Redis not found: installing..."
    sudo apt install -y redis-server
    sudo apt install -y redis-tools
fi

# install make
if ! command -v make &> /dev/null; then 
    echo "Make not found: installing..."
    sudo apt install -y make
fi

# install node
if ! command -v node &> /dev/null; then 
    echo "Node JS not found: install ...."
    curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh
    sudo bash /tmp/nodesource_setup.sh
    sudo apt install -y nodejs
fi 


#install tiny_cbor
cd $SCRIPT_DIR/deps/tiny_cbor
git clone https://github.com/intel/tinycbor
cd tinycbor
make 
sudo make install 

#install mujs
cd $SCRIPT_DIR/deps/mujs2
make 
sudo make install

# install some libraries
sudo apt install -y libmosquitto-dev

# install the necessary npm packages
cd $SCRIPT_DIR
npm install 

# compile the cside 
cd $SCRIPT_DIR/lib/cside
make archive 
cd $HOME 

# create .jamruns and make the links 
mkdir .jamruns
cd .jamruns
ln -s $SCRIPT_DIR/lib/cside clib 
ln -s $SCRIPT_DIR jamhome
ln -s $SCRIPT_DIR/lib/jside node_modules

echo "Install of JAMScript complete. Include ${SCRIPT_DIR}/tools in your executable path."

