#!/bin/bash

imagename='image'

createBridge=true
bridgename='asdf'

runCcontainers=true
numberOfContainers=10

runJScontainer=true

runJSprogram=true

runCprogram=true
numberofCprograms=10

stopCprograms=true

stopContainers=true

copyPrograms=true
folderName='folder'

if [ $createBridge == true ]
then 
    for i in `seq 1 $numberOfContainers`; do
        echo 'asdf'
    done
fi

if [ $createBridge == true ]
then 
    docker network create --driver bridge $bridgename
fi

if [ $runJScontainer == true ]
then 
    docker run --network=$bridgename --name JSnode -t -d  $imagename /bin/bash
fi

if [ $runCcontainers == true ]
then 
    for i in `seq 1 $numberOfContainers`; do
        docker run --network=$bridgename --name test$i -t -d  $imagename /bin/bash
    done
fi

if [ $copyPrograms == true ]
then 
    docker cp $folderName JSnode:/JAMScript/samples/
    for i in `seq 1 $numberofCprograms`; do
        docker cp $folderName test$i:/JAMScript/samples/
    done
fi

if [ $runJSprogram == true ]
then 
    docker exec -t JSnode /bin/bash -c "mosquitto &"
    sleep 2
    docker exec -t JSnode /bin/bash -c "node /JAMScript-beta/samples/jamout.js --app=ret"
fi

sleep 3

if [ $runCprogram == true ]
then 
    for i in `seq 1 $numberOfCprograms`; do
        docker exec -t test$i /bin/bash -c "./JAMScripts-beta/samples/a.out" &
        sleep 1
    done
fi


if [ $stopCprograms == true ]
then 
    for i in `seq 1 $numberOfCprograms`; do
        docker exec test$i pkill -f a.out
    done
fi

if [ $stopContainers == true ]
then 
    docker stop $(docker ps -a -q)
    docker rm $(docker ps -a -q)
fi
