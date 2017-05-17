#!/bin/bash
counter=1
while [ $counter -le 10 ] 
do
	(time node speed_writing.js $counter >> timing_writing.csv) 2>> timing_writing.csv
	counter="$(($counter + 1))"
done