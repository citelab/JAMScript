#!/usr/bin/env bash

srcfile=$1
destfile=${srcfile%.*}
echo "Compiling $srcfile --> $destfile"
clang  ./$srcfile  -I../include ../libjam.a -Ofast -lmosquitto -ltinycbor -o $destfile
