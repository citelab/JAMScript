#!/bin/sh
cd tests
gcc-5 -E -P -std=iso9899:199409 test_jam.c > pre_jam.c
cd ..
node jamout
cd tests
if [ "$(uname -s)" == "Darwin" ]; then
    gcc -std=iso9899:199409 jamlib.a jamout.c
elif [ "$(uname -s)" == "Linux" ]; then
    gcc -std=iso9899:199409  ../lib/jamlib/*.o jamout.c -lpthread -lbsd
fi

cd ..
