//===================================================================
// This conatains the registration and discovery logic that takes
// place though an MQTT broker on startup of a node.
//===================================================================

// I'll write this entirely as an API

var mqtt = require('mqtt');

var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();

/*

Things needed by devices only
* the ID of the fog it is connected to

Things needed by fogs only
* the ID of the cloud it is connected to
* a map of the devices connected to it
    * { id_of_device1: { status: “online”, other_info… }, id_of_device2: … }

Things needed by clouds only
* a map of the fogs connected to it
    * { id_of_fog1: { status: “online”, other_info… }, id_of_fog2: … }
*/

// QUESTION: where can I store this stuff

//==============================
// things needed by all clients
//==============================

function Subscription(topic, qos) {
    this.topic = topic;
    this.qos = qos;
}

// private
function getConnectionOptions(appName, machType, machId) {
    // create the will
    var will;

    switch (machType) {
        case 'DEVICE':
            will = {
                topic: appName + '/announce/device/' + machId + '/status',
                payload: 'offline',
                qos: 0,
                retain: true
            };
            break;
        case 'FOG':
            will = {
                topic: appName + '/announce/fog/' + machId + '/status',
                payload: 'offline',
                qos: 1,
                retain: true
            };
            break;
        case 'CLOUD':
            will = {
                topic: appName + '/announce/cloud/' + machId + '/status',
                payload: 'offline',
                qos: 1,
                retain: true
            };
            break;
        default:
            // TODO make robust
            console.log('ERROR: unrecognized node type');
            break;
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

//
// parameters
//  appName = the name of the application
//  machType = the type of the node (DEVICE, FOG, CLOUD)
//  machId = the UUID4 of the node
function connect(appName, machType, machId) {
    // connect to the broker
    // TODO: replace with remote MQTT server address
    var client = mqtt.connect('tcp://localhost:' + cmdopts.port, getConnectionOptions(appName, machType, machId));

    // connect event emitted on successful connection or reconnection
    switch (machType) {
        case 'DEVICE':
            establishDeviceProtocol(client, appName, machId);
            break;
        case 'FOG':
            establishFogProtocol(client, appName, machId);
            break;
        case 'CLOUD':
            establishCloudProtocol(client, appName, machId);
            break;
        default:
            // TODO error
            break;
    }
}

//=================================================
// lay out the protocol for devices, fogs, clouds
//=================================================

function establishDeviceProtocol(client, appName, deviceId) {

    client.on('connect', function (connack) {
        console.log("Connected to broker.\nSession present: " + connack.sessionPresent);

        // TODO determine whether this is a fresh connection or reconnect

        // assuming fresh connection...
        // subscript to fog node statuses and queries to itself
        var subscriptions = {};
        subscriptions[appName + '/annouce/fog/+/status'] = 1;
        subscriptions[appName + '/query/device/' + deviceId + '/#'] = 1;

        client.subscribe(subscriptions, function (err, granted) {
            if (err) {
                // QUESTION: how should I be dealing with/delegating errors for now?
                // TODO: handle error
            } else {
                // add the subscriptions to our array
                for (var sub in granted) {
                    // TODO

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
                // TODO handle
            }
        });
    });

    // message event when client receives a published packet
    client.on('message', function (topic, message, packet) {
        // message is Buffer
        // packet is actual packet
        console.log(typeof topic)
        console.log('Message received from topic: ' + topic)
        console.log('Message: ' + message.toString())
        client.end()
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

function establishFogProtocol(client, appName, fogId) {


}

function establishCloudProtocol(client, appName, cloudId) {


}

module.exports.connect = connect;
