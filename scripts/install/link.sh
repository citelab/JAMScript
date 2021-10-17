#!/usr/bin/env bash

echo "Doing JAMScript module linking.. "
npm link

rm -rf node_modules/jamserver
cd lib/jamserver
npm link
cd ../..
ln -s ../lib/jamserver node_modules/jamserver
rm -rf node_modules/jdiscovery
cd lib/jdiscovery
npm link
cd ../..
ln -s ../lib/jdiscovery node_modules/jdiscovery
rm -rf node_modules/flows.js
cd lib/flow
npm link
cd ../..
ln -s ../lib/flow node_modules/flows.js
