#!/usr/bin/env bash

echo "IMPORTANT: You can be prompted to enter the sudo password.."

./createNpmGlobal.sh

cd lib/jamserver 
npm install 
cd ../..

cd lib/jdiscovery
npm install 

cd ../..
npm install
npm run link