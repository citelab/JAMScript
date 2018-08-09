#!/usr/bin/env bash

# compile shell utilities
mkdir utils
cd utils
for utility in ../utilities/*.js; do
  jamc "${utility%.*}".{c,js}
done
rm -f jamout.c

# compile shell and package utilities
cd ..
jamc jamshell.{c,js} config utils
rm -r utils
