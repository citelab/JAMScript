# JAMScript Registration and Discovery

## To Run
If on Ubuntu, or other debianesque systems, you'll need to install `libavahi-compat-libdnssd-dev` for the mdns module to work:
`sudo apt install libavahi-compat-libdnssd-dev`
You'll also need to link the mdns module, regardless of whether you're on a debianesque system:
- macOS: `cd mdns && npm link`
- Ubuntu: `cd mdns && sudo npm link --unsafe-perm` (because Ubuntu sucks)
If you want to use MQTT, start an MQTT broker: `mosquitto`

### To run app.js
Try the following:
- `npm start device` - starts a device node
- `npm start device iPhone 1234567` - starts a device with attribute `iPhone` and phone number `1234567`
- `npm start device Android 1234567` - starts a device with attribute `Android` and phone number `1234567`
- `npm start fog` - starts a fog node
- `npm start cloud` - starts a cloud node
See `app.js` to figure out who discovers whom :)

### If the mdns module stops working...
You should update it! Do the following:
- Run `npm pack mdns` to download the latest mdns source
- Unzip the downloaded source
- Replace the contents of the `mdns` folder in this directory with the contents of the unzipped source
- Open up `mdns/lib/service_type.js` and comment out the sections of the code that limit the length of the advertisement's name. Currently (mdns version 2.3.4), the code blocks that do this are:
```
    if (str.length > 15) {
        throw new Error('type ' + str + ' has more than 15 characters');
    }
```
```
    if (str.length > 16) { // 16 is correct because we have a leading underscore
        throw new Error('type ' + _uu(str) + ' has more than 15 characters');
    }
```
- Follow the steps in the `To Run` section above to make sure the module is properly linked

## Registrar
The `Registrar` is the object you'll be interfacing with. It is responsible for finding other nodes running the same application as this one, and making this node visible so that other nodes may find it too. You create a Registrar as follows:
```
    var reggie = new Registrar(app, machType, id, port, config);
```
where `app` is the name of the application, `machType` (machine type) is one of 'device', 'fog', or 'cloud', `id` is the id of the node, `port` is the port it is running on, and `config` is an optional parameter with the following options:
- `protocols`: An object in which you specify what protocols you want to use. If this option is not present, all protocols will be used. e.g. To use just mDNS, you might pass
```
    {
        protocols: {
            mqtt: false,
            mdns: true,
            localStorage: false
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
- `eliminateDuplicates`: Set to `true` if you want the `Registrar` to automatically eliminate duplicate discoveries, so that only one event will be returned to the app per discovery. Set this to `false` if you want to be notified separately if/when a discovery is made by each of local storage, mDNS, and MQTT. The default is `true`.

Now, before we get into how to use our new Registrar object, we'll need to understand what **attributes** are.

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

## Announcing attributes
In order to give a node an attribute, you use the `addAttributes` API. For example, to add the thermostat attribute, you could use:

```
    // ...

    reggie.addAttributes({
        thermostat: 20
    });

    // ...
```

Or, if you want to wait to provide the temperature until the exact moment that the Registrar announces the attribute on the network, you can provide a function that returns the temperature:

```
    // ...

    reggie.addAttributes({
        thermostat: function() {
            return theTemperature;
        }
    });

    // ...
```

Lastly, if you want to keep the rest of the network up to date on your temperature, you can simply set an interval:

```
    // ...

    // update the temperature every five seconds
    setInterval(reggie.addAttributes, 5000, { thermostat: theTemperature });

    // ...
```

## API

### reggie.addAttributes(attrs)
Adds the specified attributes to the node.

`attrs` is an object of `<attributeName, attributeValue>` pairs. The `attributeName` is limited to valid JavaScript object keys. The attribute value can be any basic data type, `null`, a JavaScript object, an array, or a function that returns a basic data type, `null`, or a JavaScript object or array.

If a function is passed, then the function will be executed to retrieve the value of the attribute just before the Registrar announces the attribute on the network. If you need to pass parameters to the function, you can use bind:
```
    var x = 10;
    var y = 12;

    reggie.addAttributes({
        someAttribute: function(a, b) {
            return a + b;
        }.bind(null, x, y)
    });
```

Both the attribute name and the attribute value **should be kept brief**. The Registrar uses MQTT and mDNS under the hood, which are both lightweight messaging protocols. You may run into some trouble if you try to send too much information! **Remember: This module is should be used for basic discovery only. If nodes need to exchange larger chunks of information, then a separate connection should be made**.

#### Reserved attributes
As a general rule, you can add any attributes that you'd like. However, the following names are reserved by the system, and cannot be reused:
- `status`
- `lastCheckIn`
- `createdAt`
- `updatedAt`

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

### reggie.stopDiscoveringAttributes(dattrs)
Tells the Registrar to stop discovering the given attributes of other nodes.

`dattrs` is an object with one or more of the following keys:
-  `all`: an `Array` of attributes of **all** other nodes that the node should stop discovering
- `device`: an `Array` of attributes of devices that the node should stop discovering
- `fog`: an `Array` of attributes of fogs that the node should stop discovering
- `cloud`: an `Array` of attributes of clouds that the node should stop discovering

Alternatively, if you want to stop discovering attributes on all other nodes, regardless of type, `dattrs` cam simply be an `Array` of the attribute names.

### reggie.registerAndDiscover([options])
Kick-starts registration (announcing of attributes) and discovery.

`options` is an optional way to specify attributes of the node and those it should discover, rather than using `reggie.addAttributes` and `reggie.discoverAttributes`. It is an object that accepts the following `<key, value>` pairs:
- `attrsToAdd`: an object of the same form as that accepted by `reggie.addAttributes`
- `attrsToDiscover`: an object of the same form as that accepted by `reggie.discoverAttributes`

## Other events
In addition to `fog-up`, `fog-down`, `cloud-up`, and `cloud-down` events, the Regisrar also emits an `error` event. However, currently this event is only emitted if `MQTT` denies you from discovering certain attributes due to a permissions issue, which would be weird (at least in the current state of JAMScript) and should be flagged. The idea is that this `error` event can be extended to represent other issues that should be noted by you, the programmer.

```
    reggie.on('error', function(err) {
        switch(err.name) {
            case 'permissions_err':
                console.log(err.message);
                console.log('The following MQTT subscriptions were denied: ' + err.value);
                break;
            default:
                console.log('unknown error');
                break;
        }
    });
```

## Example
Finally, an example, putting everything together, and assuming that the type of the node (device, fog, or cloud) is indeterminate until runtime:

**app.js**
```
    var Registrar = require('./jregistrar'),
        errLog = require('../jerrlog'),
        globals = require('../constants').globals,
        events = require('events'),
        Random = require('random-js');

    var random = new Random(Random.engines.mt19937().autoSeed());

    var machType = process.argv[2],
        phoneType = process.argv[3],
        phoneNumber = process.argv[4],
        app = 'keithTest',
        port = 1337,
        id = random.uuid4();

    // don't forget to initialize the logger!
    errLog.init(app, false);

    console.log('_______________________________________________');
    console.log(machType + ' id: ' + id);
    console.log('-----------------------------------------------');
    console.log();

    var reggie = new Registrar(app, machType, id, port);

    //------------------------------------------------------------------------------
    // Default discoveries
    //------------------------------------------------------------------------------

    if (machType === 'device') {
        reggie.on('fog-up', function(fogId, connInfo) {
            console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
        });

        reggie.on('fog-down', function(fogId) {
            console.log('FOG DOWN: id: ' + fogId);
        });
    } else if (machType === 'fog') {
        reggie.on('cloud-up', function(cloudId, connInfo) {
            console.log('CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);

        });

        reggie.on('cloud-down', function(cloudId) {
            console.log('CLOUD DOWN: id: ' + cloudId);
        });
    }

    // on rare occasions, you might get an error
    reggie.on('error', function(err) {
        switch(err.name) {
            case 'permissions_err':
                console.log(err.message);
                console.log('Subscriptions: ' + err.value);
                break;
            default:
                console.log('unknown error');
                break;
        }
    });

    //------------------------------------------------------------------------------
    // Custom attributes/discoveries
    //------------------------------------------------------------------------------

    if (machType === 'device') {
        // we'll have devices announce if they are phones (iphone or android)
        // we'll say all devices are thermostats too...I know it doesn't make sense but it's just meant
        // to be demonstrative :P
        if (phoneType === 'iPhone') {
            reggie.addAttributes({
                iPhone: phoneNumber
            });
        } else if (phoneType === 'Android') {
            reggie.addAttributes({
                android: 'psych, get an iPhone!'
            });

            // in 10 seconds, turn this android into an iphone
            setTimeout(function() {
                reggie.removeAttributes('android');
                reggie.addAttributes({
                    iPhone: phoneNumber
                });
            }, 5000);
        }
        reggie.addAttributes({
            thermostat: function() {
                // returns some random number, which we'll treat as the temperature
                return 'Temperature: ' + Math.random() * 100;
            }
        });
    } else if (machType === 'fog') {
        // since we'll have clouds discover fogs, we don't need fogs to discover clouds
        reggie.stopDiscoveringAttributes({
            cloud: ['status']
        });

        reggie.discoverAttributes({
            device: {
                thermostat: {
                    onAdd: 'thermo-added',
                    onRemove: 'thermo-removed'
                }
            }
        });

        reggie.on('thermo-added', function(id, temp) {
            console.log('DEVICE ' + id + ' is a thermostat with temperature ' + temp);
        });

        reggie.on('thermo-removed', function(id, temp) {
            console.log('DEVICE ' + id + ' is no longer a thermostat');
        });
    } else {
        // maybe clouds want to discover fogs, and iphone devices
        reggie.discoverAttributes({
            device: {
                iPhone: {
                    onAdd: 'iPhone-added',
                    onRemove: 'iPhone-removed'
                },
                android: {
                    onAdd: 'android-added',
                    onRemove: 'android-removed'
                }
            },
            fog: {
                status: {
                    online: 'fog-up',
                    offline: 'fog-down'
                }
            }
        });

        reggie.on('fog-up', function(fogId, connInfo) {
            console.log('FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
        });

        reggie.on('fog-down', function(fogId) {
            console.log('FOG DOWN: id: ' + fogId);
        });

        reggie.on('iPhone-added', function(deviceId, phoneNumber) {
            console.log('DEVICE ' + deviceId + ' is an iPhone with number ' + phoneNumber);
        });

        reggie.on('iPhone-removed', function(deviceId) {
            console.log('DEVICE ' + deviceId + ' is no longer an iPhone');
        });

        reggie.on('android-added', function(deviceId, phoneNumber) {
            console.log('DEVICE ' + deviceId + ' is an Android with number: ' + phoneNumber);
        });

        reggie.on('android-removed', function(deviceId) {
            console.log('DEVICE ' + deviceId + ' is no longer an Android');
        });
    }

    reggie.registerAndDiscover();

```
