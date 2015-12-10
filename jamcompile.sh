#!/bin/sh
gcc-5 -E -P -std=iso9899:199409 tests/test_jam.c > tests/pre_jam.c
node jamout
cd tests
gcc jamout.c jamlib.a -lpthread
