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

// helper functions

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

// class definitions

function Node(type, port, app) {
    this.id = uuidGen.uuid4(); // the uuid of the device
    this.type = type;
    this.app = app;
    this.addr = getIPv4Address();
    this.port = port;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
    var subs = {};

    this.update = function() {
        this.addr = getIPv4Address();
        this.updatedAt = Date.now();
    }

    this.getURL = function() {
        return 'tcp://' + this.addr + ':' + this.port;
    }

    this.addSub = function(topic, qos, response) {
        subs[topic] = {
            qos: qos,
            response: response
        };
    }

    this.getSubs = function() {
        return subs;
    }
}

function Device(port, app, tags) {
    this.type = globals.NodeType.DEVICE;
    this.app = app;
    this.port = port;
    this.connectedFog = null; // the id of the fog this device is connected to

    var tags = tags; // the device's tags
    this.addTag = function(tag) {
        if (!tags) {
            tags = [];
        }
        tags.push(tag);
    }
    this.getTags = function() {
        return tags;
    }

    // initialize subs
    this.subs[app + '/annouce/fog/+/status'] = {
        qos: 1,
        react: function(fogId) {
            // react to being notified of a new fog
        }
    }

    this.subs[app + '/query/device/' + this.id + '/status'] = {
        qos: 1,
        react: function() {
            // react to being queried for your status
            // call the API to make a publication
        }
    }
}

// a fog node maintains one of these for each of the devices connected to it
function DeviceData(id) {
    this.id = id;
    this.addr = null;
    this.port = null;
}

function Fog(port, app) {
    this.type = globals.NodeType.FOG;
    this.app = app;
    this.port = port;
    this.cloudId = null; // the id of the cloud this fog is connected to

    var connectedDevs = null; // the devices connected to this fog
    this.getConnectedDevs = function() {
        return connectedDevs;
    }
    this.addConnectedDev = function(dev) {
        if (!(dev instanceof DeviceData)) {
            // TODO error

            return;
        }
        if (!connectetDevs) {
            connectedDevs = {};
        }
        connectedDevs[dev.id] = dev;
    }
    this.updateConnectedDev = function(id, fields) {
        if (!connectedDevs) {
            // TODO error

            return;
        }
        var dev = connectedDevs[id];
        if (!dev) {
            // TODO error

            return;
        }
        for (var key in fields) {
            dev[key] = fields[key];
        }
    }
}

function FogData(id) {
    this.id = id;
    this.addr = null;
    this.port = null;
}

function Cloud(port, app) {
    this.type = globals.NodeType.CLOUD;
    this.app = app;
    this.port = port;

    var connectedFogs = null; // the fogs connected to this cloud
    // connectedFogs can only be modified through the following functions
    this.getConnectedFogs = function() {
        return this.connectedFogs;
    }
    this.addConnectedFog = function(fog) {
        if (!(fog instanceof FogData)) {
            // TODO error

            return;
        }
        if (!connectedFogs) {
            connectedFogs = {};
        }
        connectedFogs[fog.id] = fog;
    }
    this.updateConnectedFog = function(id, fields) {
        if (!connectedFogs) {
            // TODO error

            return;
        }
        var fog = connectedFogs[id];
        if (!fog) {
            // TODO error

            return;
        }
        for (var key in fields) {
            fog[key] = fields[key];
        }
    }
}

// Device, Fog, and Cloud all inherit from Node
Device.prototype = new Node();
Fog.prototype = new Node();
Cloud.prototype = new Node();

//===========================================
// Public
//===========================================

module.exports = {

    // initialize a node based on command line opts and device parameters
    getNode: function(co, dp) {
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
