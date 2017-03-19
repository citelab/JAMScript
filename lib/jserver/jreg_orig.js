//===================================================================
// This conatains the registration and discovery logic that takes
// place though an MQTT broker on startup of a node.
//===================================================================

//===========================================
// Private
//===========================================

var mqtt = require('mqtt');

var globals = require('./globals.js');

var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();

var logger = require('./jerrlog');

/*
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

//=================================================
// lay out the protocol for devices, fogs, clouds
//=================================================

function regDevice(client, node) {

    // connect event emitted on successful connection or reconnection
    client.on('connect', function (connack) {
        console.log('Connected to broker.\nSession present: ' + connack.sessionPresent);

        // TODO determine whether this is a fresh connection or reconnect

        // assuming fresh connection...
        // subscribe to fog node statuses and queries to itself
        var subscriptions = {};
        subscriptions[appName + '/annouce/fog/+/status'] = 1;
        subscriptions[appName + '/query/device/' + deviceId + '/#'] = 1;

        client.subscribe(subscriptions, function (err, granted) {
            if (err) {
                // log it
                logger.log.error(err);
                // an error here means the node has been unable to subscribe and will therefore
                // be unresponsive to requests from other nodes. thus, it shoudl NOT publish
                // its presence on the network
                // TODO this error is fatal to this node's ability to operate within the network - what should we do?
                // TODO we could examine the error more closely and see how we could handle it
                return;
            } else {
                // add the subscriptions to the node
                for (var sub in granted) {
                    node.addSub(sub);
                }
            }
        });

        // publish our presence on the network
        var pubOpts = {
            qos: 0,
            retain: true
        };

        client.publish(appName + '/anounce/device/' + deviceId + '/status', 'online', pubOpts, function (err) {
            if (err) {
                logger.log.error(err);
                // again, an error here means that no one will know about us and so this is fatal to the node
                // TODO handle
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        // message is a Buffer
        logger.log.info('Message received from topic: ' + topic);
        logger.log.info('Message: ' + message.toString());

        // the device will have received a message to one of its subscriptions:
        // appName + '/annouce/fog/+/status'
        // appName + '/query/device/' + deviceId + '/#'
        // TODO make it easier to switch on these
        // e.g. we might want to store on the node ALL the topics it supports
        // We'll have to parse out fog ids, but there is no need to have to parse out the # part of a
        // appName + '/query/device/' + deviceId + '/#' request. We can store these to easily switch on
        // We'll need the ability to add these extensions, along with the functions to be run when a
        // request to run one is received. By default, we'll only support queries to /status
        //

    });

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

}

//===========================================
// Public
//===========================================

module.exports = {
    reg: function(node) {
        // connect to the broker
        // TODO: eventually replace with remote MQTT server address
        var client = mqtt.connect('tcp://localhost:' + cmdopts.port, getConnectionOptions(node.app, node.type, node.id));

        if (node.type === globals.NodeType.DEVICE) {
            regDevice(client, node);
        } else if (node.type === globals.NodeType.FOG) {
            regFog(client, node);
        } else {
            regCloud(client, node);
        }
    }
}
