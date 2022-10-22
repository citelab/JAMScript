#!/usr/bin/env bash

srcfile=$1
destfile=${srcfile%.*}
echo "Compiling $srcfile --> $destfile"
gcc ./$srcfile -I../src -I../include ../libjam.a -lmosquitto -ltinycbor -o $destfile