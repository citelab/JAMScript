# JDISCOVERY: A Discovery Service for JAMScript

JAMScript nodes discover each other using jdiscovery and its attribute system. Below, you will find a quick start guide as well as a description of its external and developer APIs.

## Quick Setup and Demo

### Dependencies
The following are automatically installed by the JAMScript setup scripts.
- `node.js` & `npm`
- `mosquitto` - MQTT Broker
- npm packages: `bonjour, mqtt`

### Demo
```
/* Source in apps/demo.js */

const   Registrar = require('../jregistrar-head.js'),
        globals = require('../../jamserver/constants').globals,
        events = require('events');

const   id = process.argv[2],
        type = process.argv[3],
        port = process.argv[4],
        app = 'tester';

console.log('_______________________________________________');
console.log(' id: ' + id + ' type: ' + type + ' port: ' + port);
console.log('-----------------------------------------------');
console.log();

// Construct registrar and start it
const   reggie = new Registrar(app, type, id, port,
                           { protocols: { mqtt: true, mdns: true } });
// ... if the mqtt discovery option is enabled, you need to have a broker
// ... running at the address specified in JAMScript-beta/lib/jamserver/constants.js
// ... at constants.mqtt.brokerUrl

reggie.registerAndDiscover();

// Setup default discoveries
if (type === 'device') {

    reggie.on('fog-up', function(fogId, connInfo) {
        console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });
    reggie.on('fog-down', function(fogId) {
        console.log('FOG DOWN: id: ' + fogId);
    });
} else if (type === 'fog') {

    reggie.on('cloud-up', function(cloudId, connInfo) {
        console.log('CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
    });
    reggie.on('cloud-down', function(cloudId) {
        console.log('CLOUD DOWN: id: ' + cloudId);
    });
}

// Setup custom attributes/discoveries
if (type === 'device') {
    const ticker = setInterval(
                /**
                 * XXX N.B. XXX
                 * The call must be bound to this scope
                 * using either a lambda expression,
                 * or, a call to bind()
                 * It will NOT work otherwise!
                 */
                (o) => { reggie.setAttributes(o); },
                5000,
                { secret : Math.random().toString(16) }
    );
    setTimeout(
        (attrs) => {
            clearInterval(ticker);
            reggie.removeAttributes(['secret']);
            reggie.quit();
        },
        22000
    );
} else if (type === 'fog') {
    
    reggie.on('new-secret', function(id, secret) {
        console.log('NEW-SECRET: id: ' + id + ' secret: ' + secret);
    });
    reggie.on('no-more-secret', function(id) {
        console.log('NO-MORE-SECRET: id: ' + id);
    });
    reggie.discoverAttributes({ 
        device: {
            secret: { 
                onAdd : 'new-secret', 
                onRemove : 'no-more-secret' 
            }
        }
    });
}    
```

Open two terminals to the jdiscovery directory and run the following commands (one in each).
- `node apps/demo.js node-0 device 42420`
- `node apps/demo.js node-1 fog 42421`

## API

### Import and Constructor
```
const Registrar = require('jdiscovery');
const reggie = new Registrar(app, type, id, port, config);
```
- `app`: Application name
- `type`: Node type ('device', 'fog', 'cloud')
- `id`: Node identifier (must be unique w.r.t. application name)
- `port`: Port number where the application can be reached
- `config`: Object with property `protocols` for regirstrar setup (as is for flexibility)
```
    const config =
    {
        protocols: {
            mqtt: false,
            mdns: true
        }
    }
```

### reggie.registerAndDiscover([options]);
Kick-starts registration (announcing of attributes) and discovery. **This method must be called for the registrar to start functioning; it is best to call it right after calling the constructor.** See the demo code above for an example.

`options` is an optional way to specify attributes of the node and those it should discover, rather than using `reggie.setAttributes` and `reggie.discoverAttributes`. It is an object that accepts the following `<key, value>` pairs:
- `attrsToAdd`: an object of the same form as that accepted by `reggie.setAttributes`
- `attrsToDiscover`: an object of the same form as that accepted by `reggie.discoverAttributes`

### reggie.setAttributes(attrs);
Sets the specified attributes to the node. Calling this method multiple times updates the attribute value being shared with the network.

`attrs` is an object of `<attr, value>` pairs. The `attr` is the name of the attribute and is limited to valid JavaScript object keys. The attribute `value` can be any basic data type, `null`, or a JavaScript object.

Both attribute names and values **should be kept brief**. The Registrar uses MQTT and mDNS under the hood, which are both lightweight messaging protocols. You may run into some trouble if you try to send too much information! **Remember: This module is should be used for basic discovery only. If nodes need to exchange larger chunks of information, then a separate connection should be made**.
```
    // Setting an attribute once
    reggie.setAttributes({
        thermostat: 20
    });
    // If you want to keep the rest of the network up to date on your temperature, you can simply set an interval
    // ... update the temperature every five seconds
    setInterval(
                /**
                 * XXX N.B. XXX
                 * The call must be bound to this scope
                 * using either a lambda expression,
                 * or, a call to bind()
                 * It will NOT work otherwise!
                 */
                (o) => { reggie.setAttributes(o); }, 
                5000, 
                { thermostat: _getThermostatTemp() }
    );
```

### reggie.removeAttributes(attrs);
Stop sharing the given attrs with the network.

`attrs` is an `Array` of `String`s (**not** just a `String`).

### reggie.discoverAttributes(dattrs);
Causes the node to begin discovering the given attributes of other nodes.

`dattrs` is an object with one or more of the following keys:
-  `all`: attributes of **all** other nodes that the node should discover
- `device`: attributes of devices that the node should discover
- `fog`: attributes of fogs that the node should discover
- `cloud`: attributes of clouds that the node should discover
```
    {
        all: {attr: event, ...}, // discover these attributes for all nodes
        device: {attr: event, ...}, // discover these attributes just for devices
        fog: {attr: event, ...}, // discover these attributes just for fogs
        cloud: {attr: event, ...} // discover these attributes just for clouds
    }
```
**OR** As a shortcut for _all_, one can simply pass an object of <attr, event> pairs.

The value of each of these keys should be an object of `<attr, event>` pairs, where `attr` is the name of an attribute to be discovered, and `event` is an object with keys 'onAdd' & 'onRemove' mapped to event names which will be emitted by the Registrar on discovery (`onAdd`) or on loss (`onRemove`). 
```
    reggie.discoverAttributes({
        device: {
            thermostat: {
                onAdd: 'i-found-a-thermostat',
                onRemove: 'this-node-is-no-longer-a-thermostat'
            }
        }
    });
    // register interest in these events
    reggie.on('i-found-a-thermostat', function(id, value, protocol) {
        console.log('Node ' + id + ' is apparently a thermostat with temperature ' + value);
    });
    reggie.on('this-node-is-no-longer-a-thermostat', function(id, protocol) {
        console.log('Node ' + id + ' is apparently no longer a thermostat');
    });
```
The only exception to this is when discovering the `status` attribute, in which case `event` must be an object specifying two events: one to be emitted when the remote node comes up (with `online`) and another to be emitted when it goes down (with `offline`).
```
    reggie.discoverAttributes({
        fog: {
            status: {
                online: 'fog-up',
                offline: 'fog-down'
            }
        }
    });
    // register interest in these events
    reggie.on('fog-up', function(id, connInfo, protocol) {
        console.log('Fog ' + id + ' is online, with ip ' + connInfo.ip + ' and port ' + connInfo.port);
    });
    reggie.on('fog-down', function(id, protocol) {
        console.log('Fog ' + id + ' has gone offline');
    });
```

### reggie.stopDiscoveringAttributes(dattrs);
Tells the Registrar to stop discovering the given attributes of other nodes.

`dattrs` is an object with one or more of the following keys:
-  `all`: an `Array` of attributes of **all** other nodes that the node should stop discovering
- `device`: an `Array` of attributes of devices that the node should stop discovering
- `fog`: an `Array` of attributes of fogs that the node should stop discovering
- `cloud`: an `Array` of attributes of clouds that the node should stop discovering

Alternatively, if you want to stop discovering attributes on all nodes, regardless of type, `dattrs` cam simply be an `Array` of the attribute names.

### reggie.getDiscoveryTable(handler);
Gives access to the discovery table (which is, essentially, a map of the current locally known network state). A call to getDiscoveryTable(...) does **NOT** return a copy of the discovery table. It is through the `handler` callback that the received discovery table can be processed. An example discovery table can be found below.
```
const dt = 
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

### reggie.quit();
Perform a clean exit for the current node on the network. This will lead to jdiscovery telling other nodes that the node going down is not because of a mobility-oriented disconnection.

## Developer Notes

### Registry Policies

#### MQTT

Connections between a client and a broker always use the following configuration:
- `cleanSession : true`
- `lastWill : { data : 'offline' }`
Furthermore, all messages are sent with `retain : true` which leads to broker keeping all the most recent messages on all topics to reflect the current network state at any time.
It may be noted that having `cleanSession : true` also requires a node to resubscribe to its topics of interest after any temporary disconnection.
Regarding the last will of a node, it will be published to all nodes interested in the status attribute of the publisher in the case where the connection between the publisher and the broker is interrupted.

#### MDNS

Nodes and services are discovered using the standard MDNS service discovery methodology. For node and service downs, however, we rely on a new reserved service coming up, which all nodes are configured to listen to by default. This `(app)-(type)-attrrem` service holds a list of services going down in its text record. For crash and mobility-oriented connection detection, a simple heartbeat mechanism is used. Do note that for the heartbeat mechanism to function properly, port `5454`must be free on all hosts and multicast address `239.0.0.251` should be unused by other applications on the LAN. 
