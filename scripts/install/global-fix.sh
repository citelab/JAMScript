#!/usr/bin/env bash

mkdir ~/.npm-global
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
source ~/.profile
