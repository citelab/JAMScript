#!/bin/sh
cd tests
gcc-5 -E -P -std=iso9899:199409 test_jam.c > pre_jam.c
cd ..
node jamout
cd tests
cat annotated_jamout.js | flow check-contents
gcc -std=iso9899:199409 jamlib.a jamout.c
cd ..
