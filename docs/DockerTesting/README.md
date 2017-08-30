Note that some system might require you to use sudo before each docker command.

First we need to create a network bridge on which we can run docker containers. A bridge can have up to around 1100 containers.
```
docker network create --driver bridge bridgename
```

To run a container using a particular image on a given bridge
```
docker run --network=bridgename --name containername -t -d  imagename /bin/bash
```

In order to start up a lot of containers, we will use a bash script. For example if we want to run 1000 containers on a given bridge, we can use a script like this; this will start 1000 containers named test1, ... , test1000
```
#!/bin/bash
for i in `seq 1 1000`; do
    docker run --network=bridgename --name test$i -t -d  imagename /bin/bash
done
```
We probably also want to import the compiled test programs from local machine into the docker, it works a bit like scp on linux. Here we copy a folder into containers test1, test2, ... , test400 using a bash script.
```
#!/bin/bash

for i in `seq 1 400`; do
        docker cp folderName test$i:/JAMScript/samples/
done
```

In order to start up a JS node, we can manually open up a single container in interactive mode, to do this, we run
```
docker exec -it containername /bin/bash
```

Then we need to open up the MQTT server inside the container using the command
```
mosquitto &
```
Now we can navigate to the directory that contains the JS program and start up the program using
```
node jamout.js --app=appname
```

To run a particular C program with executable name "a.out" on a single container
```
docker exec -t containername /bin/bash -c "./path/to/directory/a.out"
```

To run multiple C programs on different containers, we can use a bash script like below, here we try to open up 400 C programs on 400 containers named test1, test2, ... , test400. Note that this will take about 400 seconds to accomplish, you could reduce the sleep time between each iteration of the loop, but this could increase the risk of connection failure.
```
#!/bin/sh
for i in `seq 1 400`; do
        docker exec -t test$i /bin/bash -c "./path/to/directory/a.out" &
        sleep 1
done
```


In order to have a realistic benchmarking, there should be some network delays between the containers. To achieve this, we use the open-source software Pumba. Download the binary from https://github.com/gaia-adm/pumba
To activate it, run ./pumba with the desired parameters found on the github page. For example, to add a network delay of 25 ms to the container named "mydb" for a duration of 5 minutes.
```
./pumba netem --duration 5m delay --time 25 mydb
```
We can also add a variance to the delay, for example to have a normal distribution with variance of 10 ms
```
./pumba netem --duration 5m delay --time 25 containerName --jitter 10 --distribution normal
```
In practice for JAMScript, we only need to add the network delay to the container that's running the JS program.

After you are done with the test, or if something wrong happened during the run, we have to stop all the C programs in order to to restart the test; unless you are running JAMScript-beta in which case exiting the JS program should automatically stop all the C programs. To close all C programs on test1, ..., test400
```
#!/bin/bash
for i in `seq 1 400`; do
        docker exec test$i pkill -f a.out
done
```

Lastly if you would like to stop and remove all containers, just use the following bash script
```
docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)
```





