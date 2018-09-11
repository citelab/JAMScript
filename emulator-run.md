---
layout: page
title: Run in Emulator
subtitle: Running JAMScript Programs in a Docker-based Emulator
---

## Preliminary Steps

You need to get the *tools* to run the emulator. Follow the instructions in [Get Source](../get-src) to
download the tools and make them available for execution.

You can see the instructions for getting the JAMScript working with docker containers [here](../docker).

If everything is setup properly, you should be able to type
`djam` or `jam` and you should see a menu of sub commands available under each of them.


## Compiling and Running JAMScript in Containers

To compile a JAMScript program, do the following.

1. Write or get a JAMScript program. The easiest is to download the **JAMSamples**. Run `git clone https://github.com/citelab/JAMSamples samples` to download many example programs into a `samples` folder.
2. Change to a folder containing a valid JAMScript program. `cd samples/JData/String_Log` will change to the folder containing the string logging example.
3. To compile this program: `djam compile stringlog.*`.
4. After a successful compile, you should see `stringlog.jxe` in the folder. If not, the compilation did not succeed. You should have seen some error messages in the console to that effect.
5. Once you have compiled the sample program, you can run the program in different ways: in a device, fog, or cloud. When you run in a device, you can specify different number of C nodes as well. By default, the `djam run` sub command creates a single C node.

To run a device using the `stringlog.jxe` with 2 C nodes under the app name `q5` in background, use the following command.

```shell
djam run stringlog.jxe --num=2 --app=q5 --bg
```
To see the status of the docker JAMScript execution, run the following command.

```shell
djam list
```
You should see something like the following.

```shell
      ID         NAME      PROGRAM         HOST         D-STORE       TYPE C-NODES    TMUX-ID

      q5           q5    stringlog ec0cd9fa0887     docker:6379      cloud      -- u-501-cloud-5-cloud
      q5           q5    stringlog ad38d5fb718a     docker:6379     device       2 u-501-device-13-dev
      q5           q5    stringlog 4e0c4d9a7732     docker:6379     device       1 u-501-device-17-dev
      q5           q5    stringlog 443981d1dbbd     docker:6379     device       1 u-501-device-19-dev
      q5           q5    stringlog 7059b7d955a6     docker:6379     device       1 u-501-device-21-dev
      q5           q5    stringlog cf46d982d28b     docker:6379     device       1 u-501-device-25-dev
      q5           q5    stringlog e8d1605639d9     docker:6379     device       1 u-501-device-27-dev
      q5           q5    stringlog 79a02ca4934d     docker:6379     device       1 u-501-device-29-dev
      q5           q5    stringlog f011f39a80d8     docker:6379     device       1 u-501-device-31-dev
      q5           q5    stringlog e9fe93e89c71     docker:6379     device       1 u-501-device-33-dev
      q5           q5    stringlog c3cf5c274ab9     docker:6379     device       1 u-501-device-35-dev
      q5           q5    stringlog 45c292e451de     docker:6379        fog      -- u-501-fog-7-fog
```

The second line corresponds to the device created by the previously issued command. It is created under the `ID` `q5`. Also, the `NAME` is same as the `ID`. The `HOST` gives the docker `ID` for the container running the device. The `D-STORE` shows the URL for the data depot used by the device. By default the `djam` puts a data depot inside each container at the default port. The `TMUX-ID` shows the `tmux` terminal that runs the program. To connect to the terminal issue the
following command.

```shell
jam term u-501-device-13-dev
```

To detach from the terminal, press **Ctrl-B** and **d**. Some `djam` subcommands and interchangeable with the `jam`  subcommands (e.g., `jam term`
    `djam term` are the same).

You can start a whole topology using a script like the following.

```shell
djam init --zones=3 --indelay=3:1 --outdelay=5:3 --cldelay=30:5

djam run stringlog.jxe --cloud --app=q5 --bg

for i in `seq 1 3`; do
    djam run stringlog.jxe --fog --app=q5 --bg
done

for i in `seq 1 12`; do
    djam run stringlog.jxe --app=q5  --bg
done
```

The above script, is setting up a network with three zones. The `--indelay` in the first line is specifying the delay within a zone.
The `--outdelay` is specifying the delay across two different zones. The `--cldelay` parameter specifies the delay between the cloud and
a machine (fog or device) in a zone.
You will notice that all machines (cloud, fogs, and devices) are started with the same application name (i.e., `q5`). This is necessary for
the nodes to create a single topology. You can delete all nodes in the topology, using the following command.

```shell
djam kill q5
```

If you want to see how the delay is setup among the nodes, use the `djam test` command. It should create a **test** topology of bare nodes (i.e., no JAMScript program is running in them). You can see them running by issuing the `docker ps` command, they should have `-test` in their names.
Log in to a device, fog, and cloud test node and run a ping to a corresponding test node. You can see the network delay. To obtain the IP address of a node, run `hostname -I` while in the node.

## Description of Docker JAMScript Tools
