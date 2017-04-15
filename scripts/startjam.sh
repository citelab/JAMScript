#!/bin/bash


function startmosquitto () {
    local port=$1;
    $(/usr/local/sbin/mosquitto -p $port -d ) &
    sleep 2;
}


function findmosquitto () {
    local port=$1;
    echo $(ps axwu | grep mosquitto - | grep $port - | wc -l)
}



# Parse the following command line
# startjam.sh --clouds 1 --fogs fN --devices dN (total) --help 

# Initialize some variables
HELP=NO
CLOUDS=0
FOGS=0
DEVICES=0

while [[ $# -gt 0 ]]
do
key="$1"

case $key in

    -c|--clouds)
	CLOUDS="$2"
	shift
	;;
    -f|--fogs)
	FOGS="$2"
	shift
	;;
    -d|--devices)
	DEVICES="$2"
	shift
	;;
    -a|--app)
	APP="$2"
	shift
	;;
    -h|--help)
	HELP=YES
	;;
    *)
	;;
esac
shift
done

if [ "${HELP}" = YES ]; then

    echo "Use this script to start JAM topologies."
    echo "It starts inside a single machine."
    echo "JAM 'machines' run through MQTT instances. So different MQTT port "
    echo "numbers are used to simulate different machines."
    echo ""
    echo "**Only one cloud should be selected.**" 
    echo "You could have no clouds or fogs in your topologies"
    exit
fi

if [ "${CLOUDS}" -gt 1 ]; then
    echo "Only one cloud supported..."
    exit
fi

if [ "${APP}" = "" ]; then
    echo "App name should be specified.."
    exit
fi

# Check for file presence.. jamout.js and a.out
if [ ! -f jamout.js ]; then
    echo "Cannot find jamout.js in the current directory.."
    exit
fi

if [ ! -f a.out ]; then
    echo "Cannot find a.out in the current directory..."
    exit
fi


if [ "${CLOUDS}" = 1 ]; then

    startmosquitto 3883
    res=$(findmosquitto 3883)
    if [ $res = 1 ]; then
	echo "Starting the cloud.. "
	node jamout.js --conf=cloud.conf --app="${APP}" --cloud --port=3883 &
    fi
fi

if [ "${FOGS}" -ge 1 ]; then

    lport=$((2882+$FOGS))
    for port in $(seq 2883 $lport); do
	echo "Starting mosquitto at $port"
	startmosquitto $port
	res=$(findmosquitto $port)
	if [ $res = 1 ]; then
            echo "Starting a fog.."
            node jamout.js --conf=fog$port.conf --app=$APP --fog --port=$port &
	fi
    done
fi


if [ "${DEVICES}" -ge 1 ]; then

    lport=$((1882+$DEVICES))
    for port in $(seq 1883 $lport); do
	echo "Starting mosquitto at $port"
	startmosquitto $port
	res=$(findmosquitto $port)
	if [ $res = 1 ]; then
            echo "Starting a device (J).."
            node jamout.js --conf=dev$port.conf --app=$APP --port=$port &
            echo "Starting a device (C).."
	    $(pwd)/a.out $port &
	fi
    done
fi
