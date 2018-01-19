
# Call..like the following
# createnetwork jamtest 54
#
createnetwork() {
    local netname=$1
    local subnet=$2

    local present=`docker network ls | grep $netname | wc -l`
    if [ $present == "0" ]; then
        docker network create --driver=bridge --subnet=10.$subnet.0.0/16 --ip-range=10.$subnet.0.0/16 $netname
    fi
}



# for example, call like
# startzonerouter zonenum jamtest 54
#
startzonerouter() {
    local zonenum=$1
    local machname=$2
    local netname=$3
    local subnet=$4

    if [ `docker ps --filter name=$machname | grep $machname | wc -l` != "1" ]; then
        # Create the machine
        dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.254 $dockerImage`
        result=${dockerSer:0:12}
    fi

}


# for example, call like
# startzonemach zonenum

startzonemach() {
    local zonenum=$1
    local machname=$2
    local netname=$3
    local subnet=$4

    create_missingdir $jamfolder/zones/$zonenum
    inc_counter $jamfolder/zones/$zonenum/count
    local count=$result

    # Create the machine
    dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.$count --cap-add=NET_ADMIN $dockerImage`
    result=${dockerSer:0:12}

    # Setup the routes
    docker exec -d $machname ip route del 10.$subnet/16
    docker exec -d $machname ip route add 10.$subnet.0/24 dev eth0
    docker exec -d $machname ip route add 10.$subnet.$zonenum/24 dev eth0
    docker exec -d $machname ip route add 10.$subnet/16 via 10.$subnet.$zonenum.254

}

startglobalmach() {
    local machname=$1
    local netname=$2
    local subnet=$3

    create_missingdir $jamfolder/global
    inc_counter $jamfolder/global/count
    local count=$result

    # Create the machine
    docker run -it -d --name $machname --network=$netname --ip=10.$subnet.0.$count $dockerImage

}
