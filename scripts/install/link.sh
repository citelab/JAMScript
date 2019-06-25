#!/usr/bin/env bash

echo "--------------------11111 ----------------"

npm link

sudo rm -rf node_modules/jamserver
cd lib/jamserver
npm link
cd ../..
mv $(npm prefix -g)/lib/node_modules/jamserver node_modules

echo "--------------------2222 ----------------"

sudo rm -rf node_modules/jdiscovery
cd lib/jdiscovery
npm link
cd ../..
mv $(npm prefix -g)/lib/node_modules/jdiscovery node_modules

echo "--------------------3333 ----------------"

sudo rm -rf node_modules/flows.js
cd lib/flow
npm link
cd ../..
mv $(npm prefix -g)/lib/node_modules/flows.js node_modules

echo "--------------------4444 ----------------"
