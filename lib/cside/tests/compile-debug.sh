#!/usr/bin/env bash

srcfile=$1
destfile=${srcfile%.*}
echo "Compiling $srcfile --> $destfile"
gcc -fsanitize=address -fno-omit-frame-pointer -O1  ./$srcfile  -I../include ../libjam.a -lmosquitto -ltinycbor -o $destfile
