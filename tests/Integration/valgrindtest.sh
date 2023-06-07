#!/bin/bash

TIMEOUT=10
if [ $# -ge 1 ]; then
	TIMEOUT=$1
fi

TESTDIR="autotest"
DATE=$(date +%Y%m%d%H%M%S)

mkdir "${TESTDIR}_${DATE}"

for CFILE in $(find -name "*.c"); do
	JFILE=$(echo "$CFILE" | sed -e 's/c$/js/')
	JXE=$(echo "$CFILE" | sed -e 's/c$/jxe/')
	if [[ ! -f "$JFILE" ]]; then
		continue
	fi
	echo "Compiling ${JXE}"
	node ../../mainCompiler.js "$CFILE" "$JFILE" --output $(echo "$JXE" | sed -e 's/\.jxe$//') > /dev/null
	if [ $? -ne 0 ]; then
		echo "Compile failed... make sure the archive is compilled without asan"
		continue
	fi

	FP=$(echo "$JXE" | sed -e 's/^\.\///' -e 's/\//-/g' -e 's/\.jxe$//')
	JAMLOG="${HOME}/.jamruns/apps/$(basename "$JXE" .jxe)_${TESTDIR}/log"

	rm -f "$JAMLOG" "${JAMLOG}_valgrind"
	cd "${TESTDIR}_${DATE}"
	mkdir "$FP"
	cd ..

	echo "Running ${JXE} for ${TIMEOUT}"
	timeout $TIMEOUT jam run "$JXE" --app=$TESTDIR --log --verb --valgrind > "${TESTDIR}_${DATE}/${FP}/log_j" 2>&1
	mv "$JAMLOG" "${TESTDIR}_${DATE}/${FP}/log_c"
	mv "${JAMLOG}_valgrind" "${TESTDIR}_${DATE}/${FP}/log_valgrind"
done
