//==============================================================================
// Contains class definitions for devices, fogs, and clouds
//==============================================================================

var events = require('events'),
    logger = require('./jerrlog.js'),
    constants = require('./constants'),
    regGen = require('./regexGenerator'),
    os = require('os'),
    mqtt = require('mqtt');

//==============================================================================
// Node superclass
//==============================================================================

function Node(app, port, id) {
    this.id = id; // the uuid of the node
    this.port = port;
    this.app = app;
    this.client = null;
    this.addr = getIPv4Address();
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    /*
     * subscriptions, an array of {builtIn, topic, regex, qos, emitTag} objects
     * {
     *     isUserDefined: true or false (whether the subscription is builtIn or user-defined),
     *     topic: the topic string,
     *     regex: a regex that matches on the topic,
     *     qos: the quality of service of the subscription, 0, 1, or 2
     *     emitTag: the message to emit if a message is received (for user-defined subscriptions only)
     *     exec: the function to execute in response to receiving the message (for default subscriptions only)
     *           this function can be called with two arguments, the message topic, and the message itself
     * }
     */
    this.subs = [];
}

// Node inherits from EventEmitter
Node.prototype = new events.EventEmitter();

Node.prototype.update = function() {
    var oldAddress = this.addr;
    this.addr = getIPv4Address();
    this.updatedAt = Date.now();
    if (oldAddress !== this.addr) {
        this.emit('address-changed', oldAddress, this.addr);
    }
}

Node.prototype.getUrl = function() {
    return 'tcp://' + this.addr + ':' + this.port;
}

//------------------------------------------------------------------------------
// Node API
//------------------------------------------------------------------------------

/**
 * Add a subscription. All custom subscriptions have tags: the name of the event
 * that will be emitted in association with the subscription
 */
Node.prototype.addSub = function(topic, qos, emitTag) {
    // check that the topic is valid
    if (!regGen.isValidTopic(topic)) {
        logger.log.info('User defined topic with invalid topic name: ' + topic);
        throw new Error('invalid topic: ' + topic);
    }

    // check the validity of qos
    if (qos < 0 || qos > 2) {
        logger.log.info('User defined topic with invalid qos: ' + qos);
        throw new Error('invalid qos: ' + qos);
    }
    this.subs.push({
        isUserDefined: true,
        topic: topic,
        regex: regGen.getRegex(topic),
        qos: qos,
        emitTag: emitTag,
        exec: null
    });
}

//==============================================================================
// Device nodes
//==============================================================================

function Device(app, port, id) {
    this.type = constants.globals.NodeType.DEVICE;
    this.app = app;
    this.port = port;
    this.id = id;
    this.fogs = {}; // map from fog id to { status, port, addr }

    /* initialize subs with default subscriptions */
    this.fogStatusTopic = this.app + '/annouce/fog/+/status';
    this.statusQueryTopic = this.app + '/query/device/' + this.id + '/status';
    // subscription to fog node status updates
    this.subs.push({
        isUserDefined: false,
        topic: this.fogStatusTopic,
        regex: regGen.getRegex(this.fogStatusTopic),
        qos: 0,
        emitTag: null,
        exec: this.processFogUpdate
    });
    // subscription to queries for this device's status
    this.subs.push({
        isUserDefined: false,
        topic: this.statusQueryTopic,
        regex: regGen.getRegex(this.statusQueryTopic),
        qos: 0,
        emitTag: null,
        exec: this.replyToStatusQuery
    });
}

// inherit from node
Device.prototype = new Node();

//------------------------------------------------------------------------------
// Built-subscription handling:
// Devices handle two subscriptions by default
// 1. Fog status updates
// 2. Queries from other nodes for status updates
//------------------------------------------------------------------------------

/**
 * Process an update on the status of a fog node
 * topic [string]: app + '/annouce/fog/+/status'
 * message [string]: whether the fog is offline or online
 */
Device.prototype.processFogUpdate = function(topic, message) {

    // parse the fogId out of the topic
    var components = topic.split('/');
    var sender = components[3];
    // find the fog in our list of fogs
    var existingFog = false;
    for (var fogId in this.fogs) {
        if (fogId === sender) {
            this.fogs[fogId].status = message;
            existingFog = true;
            deviceMsg('existing fog ' + sender + ' published status update:' + message);
            break;
        }
    }

    if (!existingFog) {
        // add the fog to our fogs object
        this.fogs[sender] = { status: message };
        deviceMsg('new fog ' + sender + ' published status:' + message);
    }

    // emit event depending on whether the fog went online or offline
    if (message === 'online') {
        this.emit('fog-online', sender);
    } else {
        this.emit('fog-offline', sender);
    }
}

/**
 * Respond to a query for our status by announcing it
 */
Device.prototype.replyToStatusQuery = function() {
    this.client.publish(this.app + '/anounce/device/' + this.id + '/status', 'online', {qos: 0, retain: true}, function (err) {
        // logs publication error but does nothing else
        if (err) {
            logger.log.error(err);
        }
    });
}

//------------------------------------------------------------------------------
// Core device registration logic
//------------------------------------------------------------------------------

Device.prototype.register = function() {

    // create an mqtt client
    var client = mqtt.connect(constants.mqtt.brokerUrl, getConnectionOptions(this.app, this.type, this.id));

    // save the client on the device for future use
    this.client = client;

    var self = this;

    // connect event emitted on successful connection or reconnection
    client.on('connect', function (connack) {

        // check if reconnection
        if (connack.sessionPresent) {
            logger.log.info('Device ' + self.id + ' reconnected to broker.');
            // emit reconnection event
            self.emit('reconnect');
            return;
        }

        // set up default subsriptions:
        // fog status announcements and
        // queries for our status
        var subs = {};
        subs[self.app + '/annouce/fog/+/status'] = 1;
        subs[self.app + '/query/device/' + self.id + '/status'] = 1;

        // subscribe through the broker
        client.subscribe(subs, function (err, granted) {
            if (err) {
                logger.log.error(err);
                // an error here means the node has been unable to subscribe and will therefore
                // be unresponsive to requests from other nodes. thus, it should NOT publish
                // its presence on the network
                self.emit('registration-error');
                return;
            }
            logger.log.info('Device ' + self.id + ' subscribed to ' + JSON.stringify(granted));
        });

        // publish our presence on the network
        client.publish(self.app + '/anounce/device/' + self.id + '/status', 'online', {qos: 0, retain: true}, function (err) {
            if (err) {
                logger.log.error(err);
                // again, an error here means we should not use MQTT
                self.emit('registration-error');
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        for (var sub in self.subs) {
            // check if the topic matches that of the current subscription
            if (sub.regex.test(topic)) {
                // check if the subscription is built-in or user-defined
                if (sub.isUserDefined) {
                    // emit the message to the user
                    self.emit(sub.emitTag, topic, message.toString());
                } else {
                    // call the associated built-in function
                    sub.exec(topic, message.toString());
                }
                return;
            }
        }
        // no matching topic in list of subscriptions...
        logger.log.warning('Message received on device ' + self.id + ' for unknown topic ' + topic);
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
    */

    client.on('error', function (error) {
        logger.log.error(error);
        this.emit('registration-error');
    });
}

//==============================================================================
// Fog Nodes
//==============================================================================

function Fog(app, port, id) {
    this.type = constants.globals.NodeType.FOG;
    this.app = app;
    this.port = port;
    this.id = id;
    this.clouds = {}; // map from cloud id to { status, port, addr }

    /* initialize subs with default subscriptions */
    this.cloudStatusTopic = this.app + '/annouce/cloud/+/status';
    this.statusQueryTopic = this.app + '/query/fog/' + this.id + '/status';
    // subscription to cloud node status updates
    this.subs.push({
        isUserDefined: false,
        topic: this.cloudStatusTopic,
        regex: regGen.getRegex(this.cloudStatusTopic),
        qos: 0,
        emitTag: null,
        exec: this.processCloudUpdate
    });
    // subscription to queries for this fog's status
    this.subs.push({
        isUserDefined: false,
        topic: this.statusQueryTopic,
        regex: regGen.getRegex(this.statusQueryTopic),
        qos: 0,
        emitTag: null,
        exec: this.replyToStatusQuery
    });
}

// inherit from node
Fog.prototype = new Node();

//------------------------------------------------------------------------------
// Built-subscription handling:
// Fogs handle two subscriptions by default
// 1. Cloud status updates
// 2. Queries from other nodes for status updates
//------------------------------------------------------------------------------

/**
 * Process an update on the status of a cloud node
 * topic [string]: this.cloudStatusTopic
 * message [string]: this.statusQueryTopic
 */
Fog.prototype.processCloudUpdate = function(topic, message) {

    // parse the cloudId out of the topic
    var components = topic.split('/');
    var sender = components[3];
    // find the cloud in our list of clouds
    var existingCloud = false;
    for (var cloudId in this.clouds) {
        if (cloudId === sender) {
            this.clouds[cloudId].status = message;
            existingCloud = true;
            break;
        }
    }

    if (!existingCloud) {
        // add the cloud to our clouds object
        this.clouds[sender] = { status: message };
    }

    // emit event depending on whether the fog went online or offline
    if (message === 'online') {
        this.emit('cloud-online', sender);
    } else {
        this.emit('cloud-offline', sender);
    }
}

/**
 * Respond to a query for our status by announcing it
 */
Fog.prototype.replyToStatusQuery = function() {
    this.client.publish(this.app + '/anounce/fog/' + this.id + '/status', 'online', {qos: 1, retain: true}, function (err) {
        // logs publication error but does nothing else
        if (err) {
            logger.log.error(err);
        }
    });
}

//------------------------------------------------------------------------------
// Core fog registration logic
//------------------------------------------------------------------------------

Fog.prototype.register = function() {

    var client = mqtt.connect(constants.mqtt.brokerUrl, getConnectionOptions(this.app, this.type, this.id));
    this.client = client;
    var self = this;

    client.on('connect', function (connack) {

        if (connack.sessionPresent) {
            logger.log.info('Fog ' + self.id + ' reconnected to broker.');
            self.emit('reconnect');
            return;
        }

        /*
         * set up default subscriptions of a fog node:
         * 1. announcements on cloud statuses
         * 2. queries to the fog node's status
         */
        var subs = {};
        subs[self.cloudStatusTopic] = 1;
        subs[self.statusQueryTopic] = 1;

        client.subscribe(subs, function (err, granted) {
            if (err) {
                logger.log.error(err);
                self.emit('registration-error');
                return;
            }
            logger.log.info('Fog ' + self.id + ' subscribed to ' + JSON.stringify(granted));
        });

        // publish our presence on the network
        client.publish(self.app + '/anounce/fog/' + self.id + '/status', 'online', {qos: 1, retain: true}, function (err) {
            if (err) {
                logger.log.error(err);
                self.emit('registration-error');
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        for (var sub in self.subs) {
            // check if the topic matches that of the current subscription
            if (sub.regex.test(topic)) {
                // check if the subscription is built-in or user-defined
                if (sub.isUserDefined) {
                    // emit the message to the user
                    self.emit(sub.emitTag, topic, message.toString());
                } else {
                    // call the associated built-in function
                    sub.exec(topic, message.toString());
                }
                return;
            }
        }
        // no matching topic in list of subscriptions...
        logger.log.warning('Message received on fog ' + self.id + ' for unknown topic ' + topic);
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
    */

    client.on('error', function (error) {
        logger.log.error(error);
        self.emit('registration-error');
    });
}

//==============================================================================
// Cloud Nodes
//==============================================================================

function Cloud(app, port, id) {
    this.type = constants.globals.NodeType.CLOUD;
    this.app = app;
    this.port = port;
    this.id = id;

    /* initialize subs with default subscriptions */
    this.statusQueryTopic = this.app + '/query/cloud/' + this.id + '/status';
    // subscription to queries for this fog's status
    this.subs.push({
        isUserDefined: false,
        topic: this.statusQueryTopic,
        regex: regGen.getRegex(this.statusQueryTopic),
        qos: 0,
        emitTag: null,
        exec: this.replyToStatusQuery
    });
}

// inherit from node
Cloud.prototype = new Node();

//------------------------------------------------------------------------------
// Built-subscription handling:
// Clouds handle one subscriptions by default
// 1. Queries from other nodes for status updates
//------------------------------------------------------------------------------

/**
 * Respond to a query for our status by announcing it
 */
Cloud.prototype.replyToStatusQuery = function() {
    this.client.publish(this.app + '/anounce/cloud/' + this.id + '/status', 'online', {qos: 1, retain: true}, function (err) {
        // logs publication error but does nothing else
        if (err) {
            logger.log.error(err);
        }
    });
}

//------------------------------------------------------------------------------
// Core cloud registration logic
//------------------------------------------------------------------------------

Cloud.prototype.register = function() {

    var client = mqtt.connect(constants.mqtt.brokerUrl, getConnectionOptions(this.app, this.type, this.id));
    this.client = client;
    var self = this;

    client.on('connect', function (connack) {

        if (connack.sessionPresent) {
            logger.log.info('Cloud ' + self.id + ' reconnected to broker.');
            self.emit('reconnect');
            return;
        }

        // set up subscriptions
        var subs = {};
        // subscribe to queries to this cloud's status
        subs[self.app + '/query/cloud/' + self.id + '/status'] = 1;

        client.subscribe(subs, function (err, granted) {
            if (err) {
                logger.log.error(err);
                self.emit('registration-error');
                return;
            }
            logger.log.info('Cloud ' + self.id + ' subscribed to ' + JSON.stringify(granted));
        });

        // publish our presence on the network
        client.publish(self.app + '/anounce/cloud/' + self.id + '/status', 'online', {qos: 1, retain: true}, function (err) {
            if (err) {
                logger.log.error(err);
                self.emit('registration-error');
            }
        });
    });

    client.on('message', function (topic, message, packet) {
        for (var sub in self.subs) {
            if (sub.regex.test(topic)) {
                if (sub.isUserDefined) {
                    self.emit(sub.emitTag, topic, message.toString());
                } else {
                    sub.exec(topic, message.toString());
                }
                return;
            }
        }
        logger.log.warning('Message received on cloud ' + self.id + ' for unknown topic ' + topic);
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
    */

    client.on('error', function (error) {
        logger.log.error(error);
        self.emit('registration-error');
    });
}

//==============================================================================
// Helpers
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
    return constants.globals.localhost;
}

/**
 * returns connection options to the mqtt broker contingent upon the connecting node
 */
function getConnectionOptions(appName, machType, machId) {
    // create the will
    var will;

    if (machType === constants.globals.NodeType.DEVICE) {
        will = {
            topic: appName + '/announce/device/' + machId + '/status',
            payload: 'offline',
            qos: 0,
            retain: true
        };
    } else if (machType === constants.globals.NodeType.FOG) {
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
        clientId: machId,
        keepalive: 30,
        clean: false,
        connectTimeout: 10*1000,
        will: will
    };
}

/* Some helpers for printing messages */
function deviceMsg(id, msg) {
    console.log('DEVICE ' + id + ': ' + msg)
}

function fogMsg(id, msg) {
    console.log('FOG ' + id + ': ' + msg)
}

function cloudMsg(id, msg) {
    console.log('CLOUD ' + id + ': ' + msg)
}

//==============================================================================
// exports
//==============================================================================

module.exports = {
    getNode: function(co, dp) {
        var app = co.app,
            port = co.port,
            id = dp.getItem('deviceId');

        if (co.cloud !== undefined) {
            return new Cloud(app, port, id);
        } else if (co.fog !== undefined) {
            return new Fog(app, port, id);
        }
        return new Device(app, port, id);
    }
}
