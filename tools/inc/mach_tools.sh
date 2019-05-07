
# Call..like the following
# createnetwork jamtest 54
#
createnetwork() {
    local netname=$1
    local subnet=$2
    local folder=$3

    while : ; do
        local present=`docker network ls | grep $netname | wc -l | tr -d '[:space:]'`
        if [ $present == "0" ]; then
            docker network create --driver=bridge --subnet=10.$subnet.0.0/16 --ip-range=10.$subnet.0.0/16 $netname
            if [ $? != 0 ]; then
                # Could not create the network.. check with another subnet
                subnet=$(( $subnet + 1 ))
            else
                present=1
                if [ ! -z $folder ]; then
                    echo $subnet > $folder/network
                fi
            fi
        else
            subnet=`docker network inspect $netname | grep IPRange | awk '{split($0,a, "\""); print a[4]}' | awk '{split($0,a, "."); print a[2]}'`
            echo $subnet > $folder/network
        fi

        if [ $present == 1 ]; then
            break
        fi
    done
}



# for example, call like
# startzonerouter zonenum jamtest 54
# TODO: See whether this can actually fail due to address reuse problem..
# If so, we need to use another address... and save it in the jamrun state.
#
startzonerouter() {
    local zonenum=$1
    local machname=$2
    local netname=$3
    local subnet=$4

    local present=`docker ps -a --filter name=$machname | grep $machname | wc -l`

    if [ $present == "0" ]; then
        # Create the machine
        dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.254 $dockerImage`
        dockerSer=${dockerSer:0:12}
        result=$dockerSer
    fi

}


# for example, call like
# startzonemach zonenum

startzonemach() {
    local zonenum=$1
    local machname=$2
    local netname=$3
    local subnet=$4

    local dport=$5
    local hport=$6

    local present

    create_missingdir $jamfolder/zones/$zonenum
    while : ; do
        inc_counter $jamfolder/zones/$zonenum/count
        local count=$result
        newcount=$(( $count % 254 ))
        if [ $newcount != $count ]; then
            count=$(( $newcount + 1 ))
        fi

        echo "Machine: " $machname " starting with IP: " 10.$subnet.$zonenum.$count

        # Create the machine
        if [ -z $dport ] && [ -z $hport ]; then
            if [ -z $mount ]; then
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.$count --cap-add=NET_ADMIN --privileged -v $HOME/node_modules:/node_modules $dockerImage`
            else
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.$count --cap-add=NET_ADMIN --privileged -v $HOME/node_modules:/node_modules -v $JAMDATA:/data $dockerImage`
            fi
        else
            if [ -z $mount ]; then
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.$count --cap-add=NET_ADMIN --privileged --publish=0.0.0.0:$hport:$dport -v $HOME/node_modules:/node_modules $dockerImage`
            else
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.$zonenum.$count --cap-add=NET_ADMIN --privileged --publish=0.0.0.0:$hport:$dport -v $HOME/node_modules:/node_modules -v $JAMDATA:/data $dockerImage`
            fi
        fi
        if [ $? != 0 ]; then
            present=0
            docker rm $machname
        else
            present=1
        fi
        dockerSer=${dockerSer:0:12}
        result=$dockerSer
        if [ $present == 1 ]; then break; fi
    done

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
    local dport=$4
    local hport=$5

    local present

    create_missingdir $jamfolder/global
    set_counter 10 $jamfolder/global/count
    while : ; do
        # Above command runs if the counter is not already set
        inc_counter $jamfolder/global/count
        local count=$result
        newcount=$(( $count % 254 ))
        if [ $newcount != $count ]; then
            count=$(( $newcount + 1 ))
        fi

        # Create the machine
        if [ -z $dport ] && [ -z $hport ]; then
            if [ -z $mount ]; then
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.0.$count --cap-add=NET_ADMIN --privileged -v $HOME/node_modules:/node_modules  $dockerImage`
            else
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.0.$count --cap-add=NET_ADMIN --privileged -v $HOME/node_modules:/node_modules -v $JAMDATA:/data  $dockerImage`
            fi
        else
            if [ -z $mount ]; then
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.0.$count --cap-add=NET_ADMIN --privileged --publish=0.0.0.0:$hport:$dport -v $HOME/node_modules:/node_modules $dockerImage`
            else
                dockerSer=`docker run -it -d --name $machname --network=$netname --ip=10.$subnet.0.$count --cap-add=NET_ADMIN --privileged --publish=0.0.0.0:$hport:$dport -v $HOME/node_modules:/node_modules -v $JAMDATA:/data $dockerImage`
            fi
        fi
        if [ $? != 0 ]; then
            present=0
            docker rm $machname
        else
            present=1
        fi
        dockerSer=${dockerSer:0:12}
        result=$dockerSer
        if [ $present == 1 ]; then break; fi
    done

}
