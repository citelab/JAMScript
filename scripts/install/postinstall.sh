#!/usr/bin/env bash

sudo chmod o-w /usr/local/share/jam
sudo chmod o-w /usr/local/include
sudo chmod o-w /usr/local/lib
sudo chmod o-w /usr/local/bin

mkdir -p $HOME/.jamruns/
ln -sfn $(pwd)/node_modules $HOME/.jamruns
