#! /bin/bash

cd ..
make clean
make
cp libjam.a testers/libjam.a
cd testers
make clean
make


