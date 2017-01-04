#!/bin/sh

# Start the cloud broker
/usr/local/sbin/mosquitto -p 3883 &
echo "Started the cloud broker"
# Start the fog brokers
/usr/local/sbin/mosquitto -p 2883 &
/usr/local/sbin/mosquitto -p 2884 &
/usr/local/sbin/mosquitto -p 2885 &
echo "Started the fog brokers"
# Start the device brokers
/usr/local/sbin/mosquitto -p 1883 &
/usr/local/sbin/mosquitto -p 1884 &
/usr/local/sbin/mosquitto -p 1885 &
/usr/local/sbin/mosquitto -p 1886 &
/usr/local/sbin/mosquitto -p 1887 &
/usr/local/sbin/mosquitto -p 1888 &
/usr/local/sbin/mosquitto -p 1889 &
echo "Started the device brokers"



