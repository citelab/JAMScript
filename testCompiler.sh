#!/bin/bash/
function runTest() {
	echo "Start running " $1 "tests..."
	ext=" "
	otherFile=""
	cmd=""
	totalNum=0
	passNum=0

	declare -a failedCases
	i=1

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
				cmd="node testCompiler.js $file $otherFile"
			else
				cmd="node testCompiler.js $otherFile $file"
			fi
			output=$(eval $cmd)
			echo $file
			if [[ $output == *"Compilation finished"* ]]; then
				if [[ $file == *"invalid"* ]]; then 
					echo -e "\033[33;31mTest case failed: " $file
					failedCases[i]=$file
					let "i++"
					tput sgr0
				else 
					let "passNum++"
				fi
  			else 
  				if [[ $file == *"invalid"* ]]; then 
					let "passNum++"
				else 
					echo -e "\033[33;31mTest case failed: " $file
					failedCases[i]=$file
					let "i++"
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
		echo -e "\033[33;31mSome" $1 "test cases failed. Passed:" $passNum/$totalNum
		tput sgr0
		echo "Failed test cases:"
		for case in ${failedCases[@]}
		do 
			echo $case
		done
	fi
	echo "-----------------------------------------"
	echo $1 "tests done"
}

echo "Start running compiler tests"
runTest c
runTest jamc
 runTest js
runTest jamjs
