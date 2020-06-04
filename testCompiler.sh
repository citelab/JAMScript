echo "Start running C test cases..."
jsFile=programs/c/empty.js
totalNum=0
passNum=0
for dir in programs/c/*/ 
do
	for subDir in $dir*
	do
		allFiles=`find $subDir -maxdepth 2 -type f`
		for file in $allFiles 
		do
			let "totalNum++"
			cmd="node index.js $file $jsFile"
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
done
echo "Done"
if [ $passNum -eq $totalNum ] 
then
	echo -e "\033[33;32mAll tests passed!"
else
	echo -e "\033[33;31mSome test cases failed. Result:" $passNum/$totalNum
fi

# cFile=programs/js/empty.c