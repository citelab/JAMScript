#!/usr/bin/env bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

SHELLPID=$$
trap cleanup SIGTERM SIGINT

die() {
    printf '%s\n' "$1" >&2
    exit 1
}

VERSION=2.0

# Determine the platform we are running on
unameOut="$(uname -s)"
case "${unameOut}" in
    Linux*)     machine=Linux;;
    Darwin*)    machine=Mac;;
    *)          machine="UNKNOWN:${unameOut}"
esac

if [ $machine = Linux ]; then
    echo
    echo
    echo "Installing JAMScript Version ${VERSION} on Linux....."
    echo
    echo

    if [ -f "/etc/arch-release" ]; then
        echo "Detected Arch"
        PM_INSTALL="sudo pacman -S --needed"
        MOSQUITTO="mosquitto"
        REDIS="redis hiredis"
        LIBEVENT="libevent"

        NODE_SETUP=":"
        NODE="nodejs-lts-hydrogen"

    else
        PM_INSTALL="sudo apt-get install -y"
        MOSQUITTO="mosquitto mosquitto-clients libmosquitto-dev"
        REDIS="redis-server redis-tools libhiredis-dev"
        LIBEVENT="libevent-dev"

        NODE_SETUP="curl -sL https://deb.nodesource.com/setup_18.x -o /tmp/nodesource_setup.sh && sudo bash /tmp/nodesource_setup.sh"
        NODE="nodejs"
        sudo apt update
    fi

    # instal libevent
    eval ${PM_INSTALL} ${LIBEVENT}

    # install clang if not found
    if ! command -v clang &> /dev/null; then
        echo "Clang not found: installing..."
        eval ${PM_INSTALL} clang
    fi
    # install mosquitto clients
    if ! command -v mosquitto_pub &> /dev/null; then
        echo "Mosquitto tools not found: installing..."
        eval ${PM_INSTALL} ${MOSQUITTO}
    fi
    # install unzip
    if ! command -v unzip &> /dev/null; then
        echo "Unzip not found: installing..."
        eval ${PM_INSTALL} unzip
    fi
    # install redis
    if ! command -v redis-cli &> /dev/null; then
        echo "Redis not found: installing..."
        eval ${PM_INSTALL} ${REDIS}
    fi
    # install make
    if ! command -v make &> /dev/null; then
        echo "Make not found: installing..."
        eval ${PM_INSTALL} make
    fi
    # install node
    if ! command -v node &> /dev/null; then
        echo "Node JS not found: install ...."
        eval ${NODE_SETUP}
        eval ${PM_INSTALL} ${NODE}
    fi
	# install tmux
    if ! command -V tmux &> /dev/null; then
        echo "tmux not found: install ...."
        eval ${PM_INSTALL} tmux
    fi

elif [ $machine = Mac ]; then
    echo
    echo
    echo "Installing JAMScript Version ${VERSION} on MacOS....."
    echo
    echo

    # Check for homebrew
    if ! command -v brew &> /dev/null; then
        echo "JAMScript install needs Homebrew. You can install Homebrew from -- https://brew.sh "
        echo "Rerun JAMScript after installing Homebrew."
        exit 1
    fi
    # install wget
    if ! command -v wget &> /dev/null; then
        echo "Wget not found: installing..."
        brew install wget
    fi
    # install node
    if ! command -v node &> /dev/null; then
        echo "Node JS not found: install ..."
        curl "https://nodejs.org/dist/latest/node-${VERSION:-$(wget -qO- https://nodejs.org/dist/latest/ | sed -nE 's|.*>node-(.*)\.pkg</a>.*|\1|p')}.pkg" > "$HOME/Downloads/node-latest.pkg" && sudo installer -store -pkg "$HOME/Downloads/node-latest.pkg" -target "/"
    fi
    # install clang
    if ! command -v clang &> /dev/null; then
        echo "Clang not found: install ..."
        xcode-select --install
    fi
    # install unzip
    if ! command -v unzip &> /dev/null; then
        echo "Unzip not found: installing..."
        brew install unzip
    fi
    # install mosquitto
    if ! command -v mosquitto &> /dev/null; then
        echo "Mosquitto not found: installing..."
        brew install mosquitto
    fi
    # install make
    if ! command -v make &> /dev/null; then
        echo "Make not found: installing..."
        brew install make
    fi
    # install redis
    if ! command -v redis-server &> /dev/null; then
        echo "Redis not found: installing..."
        brew install redis hiredis
    fi

fi

#intialize carapi submmodule
cd $SCRIPT_DIR
git submodule update --init --recursive lib/

#install tinycbor
cd $SCRIPT_DIR/deps/tinycbor
git clone https://github.com/intel/tinycbor
cd tinycbor
make
sudo make install

#install mujs
cd $SCRIPT_DIR/deps/mujs2
make
sudo make install

# install the necessary npm packages
cd $SCRIPT_DIR
npm install

# compile the cside
cd $SCRIPT_DIR/lib/cside
make archive
cd $HOME

# create .jamruns and make the links
if [ ! -d .jamruns ]; then
    mkdir .jamruns
fi
cd .jamruns
# relink or link the directories
rm clib
ln -s $SCRIPT_DIR/lib/cside clib
rm jamhome
ln -s $SCRIPT_DIR jamhome
rm node_modules
ln -s $SCRIPT_DIR/lib/jside node_modules

# go back to the starting location
cd $SCRIPT_DIR

echo
echo
echo "====================================================="
echo
echo "JAMScript Version 2.0 install complete."
echo
echo "Include ${SCRIPT_DIR}/tools in your executable path."
echo
echo "Goto https://citelab.github.io/JAMScript for more information on programming in JAMScript"
echo
echo "====================================================="
