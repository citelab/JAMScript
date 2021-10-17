#!/usr/bin/env bash

echo "Installing JAMScript.."
cd lib/jamserver 
npm install 
cd ../..
cd lib/jdiscovery
npm install 
cd ../..
npm run link