#!/bin/sh
if [[ "$OSTYPE" == "darwin"* ]]; then
	gcc-5 -E -P -std=iso9899:199409 tests/test_jam.c > tests/pre_jam.c
else
	gcc -E -P -std=iso9899:199409 tests/test_jam.c > tests/pre_jam.c
fi
node jamout
cd tests
# cat annotated_jamout.js | flow check-contents
gcc jamout.c jamlib.a -lpthread
gcc -fPIC -c jamout.c
gcc -shared -o libjamout.so jamout.o jamlib.a -lpthread
zip jamout.jxe libjamout.so jamout.js MANIFEST.tml