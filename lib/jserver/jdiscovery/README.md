# README

## To Run
If on Ubuntu, or other debianesque systems, you'll need to install `libavahi-compat-libdnssd-dev` for the mdns module to work:
`sudo apt install libavahi-compat-libdnssd-dev`
You'll need to link the mdns module, regardless of whether you're on a debianesque system:
- macOS: `cd mdns && npm link`
- Ubuntu: `cd mdns && sudo npm link --unsafe-perm` (because Ubuntu sucks)
Then,
- optionally, start an MQTT server: `mosquitto`  
- run a device with `npm start device`
- run a fog with `npm start fog`
- run a cloud with `npm start cloud`

## Registrar
The `Registrar` is the object you'll be interfacing with. It is responsible for finding other nodes running the same application as this one, and making this node visible so that other nodes may find it too. You create a Registrar as follows:
```
    var reggie = new Registrar(app, machType, id, port);
```
where `app` is the name of the application, `machType` (machine type) is one of 'device', 'fog', or 'cloud', `id` is the id of the node, and `port` is the port it is running on. Now, before we get into how to use our new Registrar object, we'll need to understand what attributes are.

## Attributes
The system revolves around attributes. An attribute is some aspect of a node with an associated value (or not - an attribute need not have a value). Nodes have attributes that are discoverable by other nodes. If you can follow that, then the rest should be easy - that's really all there is to it. But, to solidify the idea, here are a couple of examples:
- `thermostat` - You might give this attribute to a device that is a thermostat. The value of this attribute could be the temperature measured by the device.
- `dimmable` - Maybe you have some smart light bulbs that can be dimmed. If so, perhaps you'd want to give them this attribute. The associated value could be the percentage of full brightness that the bulb is currently set to.
- `cellPhone` - Perhaps you want a fog node to discover all nearby devices that are cell phones, for whatever reason. You could give such devices this attribute. The value of the attribute could be null if you don't need to know anything other than the fact that the device is a cell phone. Remember: you don't need to have a value associated with an attribute.

## Discovering attributes
This module is all about registration and discovery, so obviously we'll want to discover some attributes of the nodes out there. But what is out there to begin with?

### Built-in attributes/discoveries
By default, each device, fog, and cloud on the network has only a single attribute: *status*. The *status* attribute is used to discover which nodes are online and which are offline. If a node is online, then its status attribute will have a value of form:
```
    {
        ip: ip_addr_of_node,
        port: port_of_node
    }
```
In other words, the status attribute gives you the information you need to connect to a node. If, however, the node is offline, then the value of the status attribute will be 'offline'.

In addition to giving each node the status attribute, the system is configured such that devices discover fog statuses and fogs discover cloud statuses, i.e. devices will be made aware of when fogs go online or offline, and fogs will be made aware of when clouds go online or offline. But how will you, as the programmer, be informed of these status updates? Status updates, and, in fact, all attribute discoveries, are emitted to the application by the Registrar. To wrap up our discussion of built-in attributes, we'll take a look at the built-in events the Registrar object emits: `fog-up`, `fog-down`, `cloud-up`, and `cloud-down`. An example is usually helpful.

```
    var reggie = new Registrar(app, machType, id, port);

    // devices will receive these events by default
    reggie.on('fog-up', function(id, connInfo) {
        console.log('Fog ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });

    reggie.on('fog-down', function(id) {
        console.log('Fog ' + id + ' has gone offline');
    });

    // fogs will receive these events by default
    reggie.on('cloud-up', function(id, connInfo) {
        console.log('Cloud ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });

    reggie.on('cloud-down', function(id) {
        console.log('Cloud ' + id + ' has gone offline');
    });

    // clouds will not receive any such events (by default)

    // kick-start registration and discovery
    reggie.registerAndDiscover();
```

### Custom discoveries
We see that devices discover fogs statuses and fogs discover clouds statuses by default, but what if we're a cloud node and we want to discover fogs? No problem, we can use the `discoverAttributes` API as follows:

```
    var reggie = new Registrar(app, machType, id, port);

    reggie.discoverAttributes({
        fog: {
            status: {
                online: 'fog-up',
                offline: 'fog-down'
            }
        }
    });

    // now this node (a cloud) will receive fog-up and fog-down events
    reggie.on('fog-up', function(id, connInfo) {
        console.log('Fog ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });

    reggie.on('fog-down', function(id) {
        console.log('Fog ' + id + ' has gone offline');
    });

    reggie.registerAndDiscover();
```

By this point, you're probably sick of the status attribute. Surely there are other things you'll want to discover too, for example devices that are thermostats! (exciting, right?) You're in luck! You can discover them as follows:

```
    // ...

    reggie.discoverAttributes({
        device: {
            thermostat: 'i-found-a-thermostat'
        }
    });

    reggie.on('i-found-a-thermostat', function(id, value) {
        console.log('Node ' + id + ' is apparently a thermostat with temperature ' + value);
    });

    // ...
```

...but hold on a second...isn't status the only attribute that any node has by default? Yes. If you want to be able to discover nodes that are thermostats, you'll have to first give nodes the thermostat attribute.

## Announcing attributes
In order to give a node an attribute, you use the `addAttributes` API.
