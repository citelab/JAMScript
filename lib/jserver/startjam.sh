#!/bin/sh

# Start the cloud server
node jamlib.js --conf=cloud.conf --app=ltop --cloud --port=3883 &
echo "Started the cloud server"

# Start the fog brokers
node jamlib.js --conf=fog1.conf --app=ltop --fog --port=2883 &
node jamlib.js --conf=fog2.conf --app=ltop --fog --port=2884 & 
node jamlib.js --conf=fog3.conf --app=ltop --fog --port=2885 &
echo "Started the fog brokers"

# Start the device brokers
node jamlib.js --conf=dev1.conf --app=ltop  --port=1883 &
node jamlib.js --conf=dev2.conf --app=ltop  --port=1884 &
node jamlib.js --conf=dev3.conf --app=ltop  --port=1885 &
node jamlib.js --conf=dev4.conf --app=ltop  --port=1886 &
node jamlib.js --conf=dev5.conf --app=ltop  --port=1887 &
node jamlib.js --conf=dev6.conf --app=ltop  --port=1888 &
node jamlib.js --conf=dev7.conf --app=ltop  --port=1889 &
echo "Started the device brokers"





