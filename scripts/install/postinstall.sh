#!/usr/bin/env bash

sudo chmod o-w /usr/local/share/jam
sudo chmod o-w /usr/local/include
sudo chmod o-w /usr/local/lib

mkdir -p $HOME/__jamruns/
ln -sfn $(pwd)/node_modules $HOME/__jamruns