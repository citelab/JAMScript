#!/usr/bin/env bash

echo "Installing JAMScript.."
echo "IMPORTANT: You can be prompted to enter the sudo password.."
echo 
cd lib/jamserver 
npm install 
cd ../..
cd lib/jdiscovery
npm install 
cd ../..
npm install
npm run link