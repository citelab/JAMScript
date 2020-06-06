#!/bin/bash/
function runTest() {
	echo "Start running " $1 "tests..."
	ext=" "
	otherFile=""
	cmd=""
	totalNum=0
	passNum=0

	if [ $1 == "c" ] || [ $1 == "jamc" ]
	then 
		ext=".c"
		otherFile=programs/c/empty.js
	elif [ $1 == "js" ] || [ $1 == "jamjs" ] 
	then
		ext=".js"
		otherFile=programs/js/empty.c
	fi

	for dir in programs/$1/*
	do
		allFiles=`find $dir -maxdepth 3 -name "*"$ext | sort`
		for file in $allFiles
		do
			let "totalNum++"
			if [ $1 == "c" ] || [ $1 == "jamc" ]
			then
				cmd="node index.js $file $otherFile"   # Update this to run only the compiler!!
			else
				cmd="node index.js $otherFile $file"
			fi
			output=$(eval $cmd)
			echo $file
			if [[ $output == *"Compilation finished"* ]]; then
				if [[ $file == *"invalid"* ]]; then 
					echo -e "\033[33;31mTest case failed: " $file
					tput sgr0
				else 
					let "passNum++"
				fi
  			else 
  				if [[ $file == *"invalid"* ]]; then 
					let "passNum++"
				else 
					echo -e "\033[33;31mTest case failed: " $file
					tput sgr0
				fi
			fi
		done
	done

	if [ $passNum -eq $totalNum ] 
	then
		echo -e "\033[33;32mAll" $1 "tests passed!"
		tput sgr0
	else
		echo -e "\033[33;31mSome" $1 "test cases failed. Result:" $passNum/$totalNum
		tput sgr0
	fi
	echo "\n-----------------------------------------"
	echo $1 "tests done"
}

echo "Start running compiler tests"
runTest jamc
runTest c
# runTest jamc
# runTest js
# runTest jamjs