#!/bin/bash

if ! cp "jamc" "/usr/local/bin/jamc"
then
    exit 1;
fi

if ! cp "./lib/jamlib/c_core/jam.h" "/usr/local/include"
then
    exit 1;
fi

if ! cp "libjam.a" "/usr/local/lib"
then
    exit 1;
fi

if ! cp -r "deps" "/usr/local/share/jam/"
then
    exit 1;
fi
if ! cp "jamc.js" "/usr/local/share/jam/"
then
    exit 1;
fi
if ! cp -r "lib/jamlib" "/usr/local/share/jam/lib/"
then
    exit 1;
fi
if ! cp -r "lib/jserver" "/usr/local/share/jam/lib/"
then
    exit 1;
fi
if ! cp -r "lib/ohm" "/usr/local/share/jam/lib/"
then
    exit 1;
fi
if ! cp "LICENSE" "/usr/local/share/jam/"
then
    exit 1;
fi
if ! cp -r "node_modules" "/usr/local/share/jam/"
then
    exit 1;
fi