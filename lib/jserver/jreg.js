//===================================================================
// Contains class definitions for devices, fogs, and clouds
//===================================================================

//===========================================
// Private
//===========================================
var logger = require('./jerrlog.js'),
    Random = require('random-js'),
    uuidGen = new Random(Random.engines.mt19937().autoSeed()),
    globals = require('./globals');

/**
 * Node constructor
 */

function Node(type, port, app) {
    this.id = uuidGen.uuid4(); // the uuid of the device
    this.type = type;
    this.port = port;
    this.app = app;
    this.client = null;
    this.addr = getIPv4Address();
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    this.subs = {};
}

Node.prototype.update = function() {
    this.addr = getIPv4Address();
    this.updatedAt = Date.now();
}

Node.prototype.getUrl = function() {
    return 'tcp://' + this.addr + ':' + this.port;
}

Node.prototype.addSub = function(topic, qos, response) {
    this.subs[topic] = {
        qos: qos,
        response: response
    };
}

/**
 * Device constructor
 */

function Device(port, app, tags) {
    this.type = globals.NodeType.DEVICE;
    this.app = app;
    this.port = port;
    this.connectedFog = null; // the id of the fog this device is connected to
    this.tags = [];

    // initialize subs
    this.subs[app + '/annouce/fog/+/status'] = {
        qos: 1,
        react: function(fogId) {
            // TODO react to being notified of a new fog
        }
    }

    this.subs[app + '/query/device/' + this.id + '/status'] = {
        qos: 1,
        react: function(message) {
            // TODO react to being queried for your status
            // call the API to make a publication
        }
    }
}

/**
 * add a tag to the device
 */
Device.prototype.addTag = function(tag) {
    // TODO probably some more default behavior that we want depending on what
    // we want tags used for --> confirm with Mahes
    tags.push(tag);
}

/**
 * This is where the core device registration happens
 */

Device.prototype.register = function() {

    // TODO update url of broker and save in globals
    var client = mqtt.connect('tcp://localhost:1883', getConnectionOptions(this.app, this.type, this.id));

    this.client = client;

    var self = this;

    // connect event emitted on successful connection or reconnection
    client.on('connect', function (connack) {

        if (connack.sessionPresent) {
            // reconnection
            logger.log.info('Device ' + self.id + ' reconnected to broker.');
            return;
        }

        // set up subscriptions
        var subs = {};
        // subscribe to announcements on fog statuses
        subs[self.app + '/annouce/fog/+/status'] = 1;
        // subscribe to queries to this device
        subs[self.app + '/query/device/' + self.id + '/#'] = 1;

        client.subscribe(subs, function (err, granted) {
            if (err) {
                // log it
                logger.log.error(err);
                // an error here means the node has been unable to subscribe and will therefore
                // be unresponsive to requests from other nodes. thus, it shoudl NOT publish
                // its presence on the network
                // TODO this error is fatal to this node's ability to operate within the network - what should we do?
                // TODO we could examine the error more closely and see how we could handle it
                return;
            }
            // TODO is it possible that some subscriptions might be declined?
            logger.log.info('Device ' + self.id + ' subscribed to ' + JSON.stringify(granted));
        });

        // publish our presence on the network
        client.publish(self.app + '/anounce/device/' + self.id + '/status', 'online', {qos: 0, retain: true}, function (err) {
            if (err) {
                logger.log.error(err);
                // again, an error here means that no one will know about us and so this is fatal to the node
                // TODO handle
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        // search through subs for the topic
        // if we find the topic, then we execute the function associated with the topic

    });

    /*
    client.on('reconnect', function () {
        console.log('client reconnected')
    });

    client.on('close', function () {
        console.log('client disconnected')
    });

    client.on('offline', function () {
        console.log('client has gone offline');
    });

    client.on('error', function (error) {
        console.log('client unable to connect, error: ' + error)
    });
    */
}

/**
 * Fog constructor
 */

function Fog(port, app) {
    this.type = globals.NodeType.FOG;
    this.app = app;
    this.port = port;
    this.cloudId = null; // the id of the cloud this fog is connected to
    // the devices connected to this fog
    // structure:
    // { deviceId: {addr: ip_addr, port: port_no}}
    this.connectedDevs = {};
}

Fog.prototype.addConnectedDev = function(id, ip, port) {
    this.connectedDevs[id] = {
        ip,
        port
    };
}

Fog.prototype.updateConnectedDev = function(id, fields) {
    var dev = connectedDevs[id];
    if (!dev) {
        // TODO error

        return;
    }
    for (var key in fields) {
        dev[key] = fields[key];
    }
}

/**
 * Core fog registration
 */
Fog.prototype.register = function() {

    // TODO update url of broker and save in globals
    var client = mqtt.connect('tcp://localhost:1883', getConnectionOptions(this.app, this.type, this.id));
    this.client = client;
    var self = this;

    client.on('connect', function (connack) {

        if (connack.sessionPresent) {
            // reconnection
            logger.log.info('Fog ' + self.id + ' reconnected to broker.');
            return;
        }

        // set up subscriptions
        var subs = {};
        // subscribe to announcements on cloud statuses
        subs[self.app + '/annouce/cloud/+/status'] = 1;
        // subscribe to queries to this fog
        subs[self.app + '/query/fog/' + self.id + '/#'] = 1;

        client.subscribe(subs, function (err, granted) {
            if (err) {
                logger.log.error(err);
                // TODO this error is fatal to this node's ability to operate within the network - what should we do?
                // TODO we could examine the error more closely and see how we could handle it
                return;
            }
            // TODO is it possible that some subscriptions might be declined?
            logger.log.info('Fog ' + self.id + ' subscribed to ' + JSON.stringify(granted));
        });

        // publish our presence on the network
        client.publish(self.app + '/anounce/fog/' + self.id + '/status', 'online', {qos: 1, retain: true}, function (err) {
            if (err) {
                logger.log.error(err);
                // again, an error here means that no one will know about us and so this is fatal to the node
                // TODO handle
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        // search through subs for the topic
        // if we find the topic, then we execute the function associated with the topic

    });

    /*
    client.on('reconnect', function () {
        console.log('client reconnected')
    });

    client.on('close', function () {
        console.log('client disconnected')
    });

    client.on('offline', function () {
        console.log('client has gone offline');
    });

    client.on('error', function (error) {
        console.log('client unable to connect, error: ' + error)
    });
    */
}

/**
 * Cloud prototype
 */

function Cloud(port, app) {
    this.type = globals.NodeType.CLOUD;
    this.app = app;
    this.port = port;

    this.connectedFogs = null; // the fogs connected to this cloud
}

Cloud.prototype.addConnectedFog = function(id, ip, port) {
    connectedFogs[id] = {
        ip,
        port
    };
}

Cloud.prototype.updateConnectedFog = function(id, fields) {
    var fog = connectedFogs[id];
    if (!fog) {
        // TODO error

        return;
    }
    for (var key in fields) {
        fog[key] = fields[key];
    }
}

/**
 * Core cloud registration
 */

Cloud.prototype.register = function() {
    // TODO update url of broker and save in globals
    var client = mqtt.connect('tcp://localhost:1883', getConnectionOptions(this.app, this.type, this.id));
    this.client = client;
    var self = this;

    client.on('connect', function (connack) {

        if (connack.sessionPresent) {
            // reconnection
            logger.log.info('Cloud ' + self.id + ' reconnected to broker.');
            return;
        }

        // set up subscriptions
        var subs = {};
        // subscribe to queries to this cloud
        subs[self.app + '/query/cloud/' + self.id + '/#'] = 1;

        client.subscribe(subs, function (err, granted) {
            if (err) {
                logger.log.error(err);
                // TODO this error is fatal to this node's ability to operate within the network - what should we do?
                // TODO we could examine the error more closely and see how we could handle it
                return;
            }
            // TODO is it possible that some subscriptions might be declined?
            logger.log.info('Cloud ' + self.id + ' subscribed to ' + JSON.stringify(granted));
        });

        // publish our presence on the network
        client.publish(self.app + '/anounce/cloud/' + self.id + '/status', 'online', {qos: 1, retain: true}, function (err) {
            if (err) {
                logger.log.error(err);
                // again, an error here means that no one will know about us and so this is fatal to the node
                // TODO handle
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        // search through subs for the topic
        // if we find the topic, then we execute the function associated with the topic

    });

    /*
    client.on('reconnect', function () {
        console.log('client reconnected')
    });

    client.on('close', function () {
        console.log('client disconnected')
    });

    client.on('offline', function () {
        console.log('client has gone offline');
    });

    client.on('error', function (error) {
        console.log('client unable to connect, error: ' + error)
    });
    */
}


/**
 * Device, Fog, and Cloud all inherit from Node
 */
Device.prototype = new Node();
Fog.prototype = new Node();
Cloud.prototype = new Node();

//==============================================================================
// helper functions
//==============================================================================

/**
 * returns the IPv4 address of this node
 */
function getIPv4Address() {
    var niaddrs = os.networkInterfaces();
    for (var ni in niaddrs) {
        nielm = niaddrs[ni];
        for (n in nielm) {
            if (nielm[n].family === 'IPv4' && nielm[n].internal === false)
                return nielm[n].address
        }
    }
    return '127.0.0.1';
}

/**
 * returns connection options to the mqtt broker contingent upon the connecting node
 */
function getConnectionOptions(appName, machType, machId) {
    // create the will
    var will;

    if (machType === globals.NodeType.DEVICE) {
        will = {
            topic: appName + '/announce/device/' + machId + '/status',
            payload: 'offline',
            qos: 0,
            retain: true
        };
    } else if (machType === globals.NodeType.FOG) {
        will = {
            topic: appName + '/announce/fog/' + machId + '/status',
            payload: 'offline',
            qos: 1,
            retain: true
        };
    } else {
        will = {
            topic: appName + '/announce/cloud/' + machId + '/status',
            payload: 'offline',
            qos: 1,
            retain: true
        };
    }

    // set and return the connection options
    return {
        clientId: id,
        keepalive: 30,
        clean: false,
        connectTimeout: 10*1000,
        will: will
    };
}

//==============================================================================
// exports
//==============================================================================

module.exports = {
    initNode: function(co, dp) {
        var app = co.app,
            port = co.port;

        if (co.cloud !== undefined) {
            return new Cloud(port, app);
        } else if (co.fog !== undefined) {
            return new Fog(port, app);
        }
        return new Device(port, app);
    }
}
