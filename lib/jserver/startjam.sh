#!/bin/bash



function startmosquitto () {
    local port=$1;
    $(/usr/local/sbin/mosquitto -p $port -d ) &
    sleep 1;
}


function findmosquitto () {
    local port=$1;
    echo $(ps axwu | grep mosquitto - | grep $port - | wc -l)
}


# Starting the cloud

startmosquitto 3883
res=$(findmosquitto 3883)
if [ $res = 1 ]; then
    echo "Starting the cloud.. "
    node jamlib.js --conf=cloud.conf --app=ret7 --cloud --port=3883 &
fi

# Starting the fogs

for port in $(seq 2883 2886);
do
    echo "Starting mosquitto at $port"
    startmosquitto $port 
    res=$(findmosquitto $port)
    if [ $res = 1 ]; then
	echo "Starting a fog.."
	node jamlib.js --conf=fog$port.conf --app=ret7 --fog --port=$port &
    fi
done

# Starting the devices

for port in $(seq 1883 1890);
do
    echo "Starting mosquitto at $port"
    startmosquitto $port 
    res=$(findmosquitto $port)
    if [ $res = 1 ]; then
	echo "Starting a device.."
	node jamlib.js --conf=dev$port.conf --app=ret7 --port=$port &
    fi
done
