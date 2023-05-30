#!/bin/bash

JAMLOG="${HOME}/.jamruns/apps/jt2_twheelquery/log"

if [[ ! -d "autotest_twheel" ]]; then
	mkdir "autotest_twheel"
fi

if [[ ! -f "jt2.jxe" ]]; then
	jamc jt2.* -d
fi

while :
do
	rm -rf "$JAMLOG"
	killall -9 a.out
	echo "running"
	timeout 10 jam run "jt2.jxe" --app=twheelquery --verb --log > "autotest_twheel/log_j" 2>&1
	result=$(grep "message-to-j" "autotest_twheel/log_j")
	if [ ! -n "$result" ]; then
		head -n -2 "autotest_twheel/log_j" > "autotest_twheel/log_j"
		cp "$JAMLOG" "autotest_twheel/log_c"
		exit
	fi
done
