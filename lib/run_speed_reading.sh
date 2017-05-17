#!/bin/bash
counter=1
while [ $counter -le 10 ] 
do
	(time node speed_reading.js $counter >> timing_reading.csv) 2>> timing_reading.csv
	counter="$(($counter + 1))"
done