#! /bin/bash
if [ $# -eq 0 ]
  then
  echo "No Files to be compiled ..."
fi

OS="`uname`"
case $OS in
  'Linux')
    OS='Linux'
    CC="clang -Wall -g"
    LDFLAGS=" -D__LINUX__ -I/usr/local/share/jam/lib/jamlib/c_core -lbsd -lcbor -lnanomsg -lpthread -ljam -ltask"
    ;;
  'FreeBSD')
    OS='FreeBSD'
    alias ls='ls -G'
    ;;
  'WindowsNT')
    OS='Windows'
    ;;
  'Darwin') 
    OS='Mac'
    CC="clang -Wall -g"
    LDFLAGS="-D__APPLE__ -I/usr/local/share/jam/lib/jamlib/c_core -lcbor -lnanomsg -ljam -ltask"
    ;;
  'SunOS')
    OS='Solaris'
    ;;
  'AIX') ;;
  *) ;;
esac


for var in "$@"
do
    $CC $var $LDFLAGS -o "c_exec_$var"
    echo $CC $var $LDFLAGS -o f_$var.o
done    

echo "Compilation Complete ... "
