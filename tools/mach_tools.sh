
startzonerouter() {
    local zonenum=$1
    # Create the machine
    docker run -it -d --name $2 --network=jamtest --ip=10.54.$zonenum.254 $dockerImage
}


startzonemach() {
    local zonenum=$1
    if [ ! -e $jamfolder/zones ]; then
        mkdir $jamfolder/zones
    fi
    if [ ! -e $jamfolder/zones/count ]; then
        echo "10" > $jamfolder/zones/count
    fi
    local count=`cat $jamfolder/zones/count`
    ((count++))
    echo $count > $jamfolder/zones/count

    # Create the machine
    docker run -it -d --name $2 --network=jamtest --ip=10.54.$zonenum.$count --cap-add=NET_ADMIN $dockerImage

    # Setup the routes
    docker exec -d $2 ip route del 10.54/16
    docker exec -d $2 ip route add 10.54.0/24 dev eth0
    docker exec -d $2 ip route add 10.54.$zonenum/24 dev eth0
    docker exec -d $2 ip route add 10.54/16 via 10.54.$zonenum.254

}

startglobalmach() {

    if [ ! -e $jamfolder/global ]; then
        mkdir $jamfolder/global
    fi
    if [ ! -e $jamfolder/global/count ]; then
        echo "10" > $jamfolder/global/count
    fi
    local count=`cat $jamfolder/global/count`
    ((count++))
    echo $count > $jamfolder/global/count

    # Create the machine
    docker run -it -d --name $1 --network=jamtest --ip=10.54.0.$count $dockerImage

}
