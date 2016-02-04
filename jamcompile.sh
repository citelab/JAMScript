#!/bin/sh
if [ $# -eq 0 ]; then
    echo "No input file specified"
    echo "Input format:"
    echo "\tjamcompile [input file] [jamlib.a path] [output name]"
    exit 1
fi
if [ $# -eq 1 ]; then
    echo "jamlib not specified"
    echo "Input format:"
    echo "\tjamcompile [input file] [jamlib.a path] [output name]"
    exit 1
fi
if [ $# -eq 3 ]; then
    ONAME="$3"
else
    ONAME="jamout"
fi
mkdir -p output
if [[ "$OSTYPE" == "darwin"* ]]; then
    gcc-5 -E -P -std=iso9899:199409 $1 > output/pre_jam.c
else
    gcc -E -P -std=iso9899:199409 $1 > output/pre_jam.c
fi
node jamout
# cat annotated_jamout.js | flow check-contents
gcc output/jamout.c $2 -lpthread -o output/a.out
gcc -fPIC -c output/jamout.c -o output/jamout.o
gcc -shared -o output/libjamout.so output/jamout.o $2 -lpthread
zip output/$ONAME.jxe output/libjamout.so output/jamout.js output/MANIFEST.tml