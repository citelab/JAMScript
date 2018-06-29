# JDISCOVERY: A Discovery Service for JAMScript

JAMScript nodes discover each other using jdiscovery and its attribute system. Below, you will find a quick start guide as well as a description of its external and developer APIs.

## Quick Setup and Demo

### Dependencies
The following are automatically installed by the JAMScript setup scripts.
- `node.js` & `npm`
- `mosquitto` - MQTT Broker
- npm packages: `bonjour, mqtt`

### Demo
Open two terminals to the jdiscovery directory and run the following commands (one in each).
- `node apps/tester.js node-0 device 42420`
- `node apps/tester.js node-1 fog 42421`

## System Description

### Registrar
The `Registrar` is the object you'll be interfacing with. It is responsible for finding other nodes running the same application as this one, and making this node visible so that other nodes may find it too. You create a Registrar as follows:
```
    var reggie = new Registrar(app, type, id, port, config);
```
where `app` is the name of the application, `type` (machine type) is one of 'device', 'fog', or 'cloud', `id` is the id of the node, `port` is the port it is running on, and `config` is an optional parameter with the following options:
- `protocols`: An object in which you specify what protocols you want to use. If this option is not present, all protocols will be used. e.g. To use just mDNS, you might pass
```
    {
        protocols: {
            mqtt: false,
            mdns: true,
        }
    }
```
Alternatively
```
    {
        protocols: {
            mdns: true
        }
    }
```
will suffice.

Now, before we get into how to use our new Registrar object, we'll need to understand what **attributes** are.

### Attributes
The system revolves around attributes. An attribute is some aspect of a node with an associated value (or not - an attribute need not have a value). Nodes have attributes that are discoverable by other nodes. If you can follow that, then the rest should be easy - that's really all there is to it. But, to solidify the idea, here are a couple of examples:
- `thermostat` - You might give this attribute to a device that is a thermostat. The value of this attribute could be the temperature measured by the device.
- `dimmable` - Maybe you have some smart light bulbs that can be dimmed. If so, perhaps you'd want to give them this attribute. The associated value could be the percentage of full brightness that the bulb is currently set to.
- `cellPhone` - Perhaps you want a fog node to discover all nearby devices that are cell phones, for whatever reason. You could give such devices this attribute. The value of the attribute could be null if you don't need to know anything other than the fact that the device is a cell phone. Remember: you don't need to have a value associated with an attribute.

### Discovering attributes
This module is all about registration and discovery, so obviously we'll want to discover some attributes of the nodes out there. But what is out there to begin with?

#### Built-in attributes/discoveries
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
    reggie.on('fog-up', function(id, connInfo, protocol) {
        console.log('Fog ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });

    reggie.on('fog-down', function(id, protocol) {
        console.log('Fog ' + id + ' has gone offline');
    });

    // fogs will receive these events by default
    reggie.on('cloud-up', function(id, connInfo, protocol) {
        console.log('Cloud ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });

    reggie.on('cloud-down', function(id, protocol) {
        console.log('Cloud ' + id + ' has gone offline');
    });

    // clouds will not receive any such events (by default)

    // kick-start registration and discovery
    reggie.registerAndDiscover();
```

#### Custom discoveries
We see that devices discover fogs statuses and fogs discover clouds statuses by default, but what if we're a cloud node and we want to discover fogs? No problem, we can use the `discoverAttributes` API as follows:

```
    var reggie = new Registrar(app, type, id, port);

    reggie.discoverAttributes({
        fog: {
            status: {
                online: 'fog-up',
                offline: 'fog-down'
            }
        }
    });

    // now this node (a cloud) will receive fog-up and fog-down events
    reggie.on('fog-up', function(id, connInfo, protocol) {
        console.log('Fog ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });

    reggie.on('fog-down', function(id, protocol) {
        console.log('Fog ' + id + ' has gone offline');
    });

    reggie.registerAndDiscover();
```

By this point, you're probably sick of the status attribute. Surely there are other things you'll want to discover too, for example devices that are thermostats! (exciting, right?) You're in luck! You can discover them as follows:

```
    // ...

    reggie.discoverAttributes({
        device: {
            thermostat: {
                onAdd: 'i-found-a-thermostat',
                onRemove: 'this-node-is-no-longer-a-thermostat'
            }
        }
    });

    reggie.on('i-found-a-thermostat', function(id, value, protocol) {
        console.log('Node ' + id + ' is apparently a thermostat with temperature ' + value);
    });

    reggie.on('this-node-is-no-longer-a-thermostat', function(id, protocol) {
        console.log('Node ' + id + ' is apparently no longer a thermostat');
    });

    // ...
```

Notice the parameters to the functions called upon a discovery. When a discovery is made, the following arguments are available:
- `nodeId`: the ID of the node for which the discovery was made
- `attributeValue`: the value of the attribute discovered
- `protocol`: the protocol which made the discovery
    - The protocol will be one of the values defined in `../jamserver/constants.js#globals.Protocol`
When an attribute is removed from a node, or the node goes down (status becomes offline), then there are just two parameters to the function:
- `nodeId`: the ID of the node which removed the attribute, or went down
- `protocol`: the protocol which made the discovery

Now back to attributes. If status is the only attribute that any node has by default, then how can we give nodes other attributes? This is done by announcing attributes.

### Announcing attributes
In order to give a node an attribute, you use the `setAttributes` method of the Registrar. For example, to add the thermostat attribute, you could use:

```
    // ...

    reggie.setAttributes({
        thermostat: 20
    });

    // ...
```

If you want to keep the rest of the network up to date on your temperature, you can simply set an interval:

```
    // ...

    // update the temperature every five seconds
    setInterval(reggie.setAttributes, 5000, { thermostat: theTemperature });

    // ...
```

## External API

### Import and Constructor
```
const Registrar = require('jdiscovery');
const reggie = new Registrar(app, type, id, port, config);
```

### reggie.registerAndDiscover([options]);
Kick-starts registration (announcing of attributes) and discovery.

`options` is an optional way to specify attributes of the node and those it should discover, rather than using `reggie.addAttributes` and `reggie.discoverAttributes`. It is an object that accepts the following `<key, value>` pairs:
- `attrsToAdd`: an object of the same form as that accepted by `reggie.addAttributes`
- `attrsToDiscover`: an object of the same form as that accepted by `reggie.discoverAttributes`

### reggie.setAttributes(attrs)
Sets the specified attributes to the node.

`attrs` is an object of `<attributeName, attributeValue>` pairs. The `attributeName` is limited to valid JavaScript object keys. The attribute value can be any basic data type, `null`, a JavaScript object, an array, or a function that returns a basic data type, `null`, or a JavaScript object or array.

Both the attribute name and the attribute value **should be kept brief**. The Registrar uses MQTT and mDNS under the hood, which are both lightweight messaging protocols. You may run into some trouble if you try to send too much information! **Remember: This module is should be used for basic discovery only. If nodes need to exchange larger chunks of information, then a separate connection should be made**.

### reggie.removeAttributes(attrs)
Removes the specified attributes from the node.

`attrs` can be a `String` or an `Array` of `String`s.

### reggie.discoverAttributes(dattrs)
Causes the node to begin discovering the given attributes of other nodes.

`dattrs` is an object with one or more of the following keys:
-  `all`: attributes of **all** other nodes that the node should discover
- `device`: attributes of devices that the node should discover
- `fog`: attributes of fogs that the node should discover
- `cloud`: attributes of clouds that the node should discover

The value of each of these keys should be an object of `<attributeName, eventName>` pairs, where `attributeName` is the name of an attribute to be discovered, and `eventName` is the name of the event to have the Registrar emit when it makes a discovery. The only exception to this is when discovering the `status` attribute, in which case `eventName` must be an object specifying two events: one to be emitted when the remote node comes up (with key `online`) and another to be emitted when it goes down (with key `offline`), e.g. `{ online: 'aNodeWentUp', offline: 'ohNoItWentDown' }`.

If you wish to just pass attributes to be discovered on all other nodes, regardless of device, fog, or cloud, then `dattrs` can simply be an object of `<attributeName, eventName>` pairs.

In other words, dattrs can have one of the following forms:
(a)
```
    {
        all: {attr: event, ...}, // discover these attributes for all nodes
        device: {attr: event, ...}, // discover these attributes just for devices
        fog: {attr: event, ...}, // discover these attributes just for fogs
        cloud: {attr: event, ...} // discover these attributes just for clouds
    }
(b) As a shortcut for _all_, one can simply pass an object of <attr, event> pairs
    For the status attribute, the format is:
```
        status: {
            online: 'fog-up',
            offline: 'fog-down'
        }
```
    Whereas for custom attributes, the format is:
```
        is_a_phone: {
            onAdd: 'phone-found'
            onRemove: 'phone-lost'
        }
```

### reggie.stopDiscoveringAttributes(dattrs)
Tells the Registrar to stop discovering the given attributes of other nodes.

`dattrs` is an object with one or more of the following keys:
-  `all`: an `Array` of attributes of **all** other nodes that the node should stop discovering
- `device`: an `Array` of attributes of devices that the node should stop discovering
- `fog`: an `Array` of attributes of fogs that the node should stop discovering
- `cloud`: an `Array` of attributes of clouds that the node should stop discovering

Alternatively, if you want to stop discovering attributes on all other nodes, regardless of type, `dattrs` cam simply be an `Array` of the attribute names.

### reggie.quit();
Perform a clean exit for the current node on the network.

## Developer Notes

### Discovery Table
Notes:
 --> We don't keep an entry for our own node
And an example...
```
{
     node_id : {
         'attrs' : {
             'status' : {
                 'seqval' : seqval,
                 'data' : data
             },
             other_attr : {
                 'seqval' : seqval,
                 'data' : data
             }
         }
         'network' : 'LAN' || 'WAN',
         'other_useful_info' : ...
     },
     other_node_id : {
         ...
     }
}
```
