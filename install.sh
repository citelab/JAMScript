#!/usr/bin/env bash

echo "Installing JAMScript.."
if [[ $UID != 0 ]]; then
    echo "Please run this script with sudo:"
    echo "sudo $0 $*"
    exit 1
fi

if [[ $OSTYPE != 'darwin'* ]]; then
  echo "The local environment is not MacOS. Installing a compatibility layer for mDNS modules..."
  apt install libavahi-compat-libdnssd-dev
fi

echo "Please run ./install2.sh to finish the installation."