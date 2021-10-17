#!/usr/bin/env bash

echo "Doing JAMScript module linking.. "
npm link

rm -rf node_modules/jamserver
ln -s ../lib/jamserver node_modules/jamserver
rm -rf node_modules/jdiscovery
ln -s ../lib/jdiscovery node_modules/jdiscovery
rm -rf node_modules/flows.js
ln -s ../lib/flow node_modules/flows.js
