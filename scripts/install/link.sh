#!/usr/bin/env bash

npm link

rm -rf node_modules/jamserver
ln -sfn $(pwd)/lib/jamserver node_modules

rm -rf node_modules/jdiscovery
ln -sfn $(pwd)/lib/jdiscovery node_modules

rm -rf node_modules/flows.js
ln -sfn $(pwd)/lib/flow node_modules/flows.js