
test run

no validation suite at this point.



paring your system (Ubuntu)


Install dependencies:
```shell
cd script/install
./depend-install-ubuntu.sh
```
This will install all the dependencies, including the newest Node.js on your system.

Configure node_modules path:
```shell
vi ~/.bashrc
add the following line:
export NODE_PATH=$HOME/node_modules:/usr/local/lib/node_modules:$NODE_PATH
save file and quit
source .bashrc
```

Install JAMScript:
```shell
./jamscript-install.sh
```

Run `which jamc` to verify that JAMScript compiler installed on your system. It should show the location of jamc.

## Preparing your Raspberry Pi

Copy depend-rpi.sh and jamscript-on-ubuntu.sh from scripts/install into the root folder of JAMScript, then run the following commands:
```shell
./depend-rpi.sh
./jamscript-on-ubuntu.sh
```


## Build a docker image of JAMScript-beta

Get the Dockerfile from /scripts/install.
Then run the following command from where the Dockerfile is located

```shell
docker build -t imageName .
```

**To run a JS node on a container**, enter the following command first, the `--privileged` is needed in order to start avahi-daemon.

```shell
docker run -t --privileged --name containerName imageName
```

Then to run an actual JS program on this container, get into command line of the container by doing

```shell
docker exec -it containerName /bin/bash
```

Start up MQTT server manually by doing
```shell
mosquitto &
```

Now you are ready to start up a JS program


**To run a C program in a separate container**, start up a container by doing
```shell
docker run --name containerName -t -d  imagename /bin/bash
```

Get into command line the same way
```shell
docker exec -it containerName /bin/bash
```

Or you could directly execute a C program by entering

```shell
docker exec -t containerName /bin/bash -c "./path/to/directory/a.out"
```
