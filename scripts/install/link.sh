#!/usr/bin/env bash

npm link

sudo rm -rf node_modules/jamserver
cd lib/jamserver
npm link
cd ../..
mv $(npm prefix -g)/lib/node_modules/jamserver node_modules

sudo rm -rf node_modules/jdiscovery
cd lib/jdiscovery
npm link
cd ../..
mv $(npm prefix -g)/lib/node_modules/jdiscovery node_modules

sudo rm -rf node_modules/flows.js
cd lib/flow
npm link
cd ../..
mv $(npm prefix -g)/lib/node_modules/flows.js node_modules
