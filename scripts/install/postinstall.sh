#!/usr/bin/env bash
NAME=${SUDO_USER:-${USER}}

mkdir -p $HOME/__jamruns/
ln -s $PWD/node_modules $HOME/__jamruns/node_modules
sudo chown -R $NAME:$NAME $HOME/__jamruns/
