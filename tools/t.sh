counter=0
m=10
while [ $counter -le $m ]; do
	echo $counter
	((counter++))
done
