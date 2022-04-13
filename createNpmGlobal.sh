#!/usr/bin/env bash

if [ -d "~/.npm-global" ]; then
  rm -r ~/.npm-global
fi

npm config set prefix '~/.npm-global'

echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile

