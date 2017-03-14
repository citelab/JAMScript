// = Create a machine registry. We can make it a local storage so it works with
//   mininet. TODO: Make it work with Xiru's remote registry as well.

//   Creation/addition:
//     = Create machine registry - with a name - filename reflects the machine name
//       (machine name and app name are the same)
//     = Only one cloud node for now. Fail if multiple cloud nodes are added to the
//       registry. This could be a problem with the UUID4 generation.
//     = Add as many fog and device nodes. If the fog/device is already there, don't add.
//   Updates:
//     = Update the IP address of the node. If the node is not the cloud, it should
//       have a parent. The parent should be active (any node that is not updated for the
//       last K seconds is considered inactive. If the parent is inactive, select another
//       parent.
//   Query:
//     = find the fog:
//       Used by the device to find the fog
//     = find the cloud:
//       Used by the fog to find the cloud
//     = find the cloud for the device:
//       Used by the device that is connected to a given fog to find the cloud

// TODO: There could be an issue with multiple nodes writing to the local storage at the
// same time

var os = require('os'),
    Random = require('random-js'),
    rgen = new Random(),
    uuidGen = new Random(Random.engines.mt19937().autoSeed());

// define the types of the nodes in an enum
var NodeType = Object.freeze({
    DEVICE: 'DEVICE',
    FOG: 'FOG',
    CLOUD: 'CLOUD'
});

//============================================================
// Class definitions for devices, fogs, and clouds
//============================================================

function Node(type, port) {
    this.id = uuidGen.uuid4(); // the uuid of the device
    this.type = type;
    this.addr = getIPv4Address();
    this.port = port;
    this.createdAt = Date.now();
    this.updatedAt = Date.now();

    this.update = function() {
        this.addr = getIPv4Address();
        this.updatedAt = Date.now();
    }

    this.getURL = function() {
        return 'tcp://' + this.addr + ':' + this.port;
    }
}

function Device(port, tags) {
    this.type = NodeType.DEVICE;
    this.port = port;
    this.regSubs = null; // the registration subscriptions to the remote broker
    this.fogId = null; // the id of the fog this device is connected to

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
}

// a fog node maintains one of these for each of the devices connected to it
function DeviceData(id) {
    this.id = id;
    this.addr = null;
    this.port = null;
}

function Fog(port) {
    this.type = NodeType.FOG;
    this.port = port;
    this.regSubs = null;
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

function Cloud(port) {
    this.type = NodeType.CLOUD;
    this.port = port;
    this.regSubs = null;

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

// returns either a Node or a LocalRegistry
module.exports = new function (co, dp) {

    var registry = co.registry,
        app = co.app;

    if (registry) {
        // set up and return the device
        if (co.cloud !== undefined) {
            var cloud = new Cloud(co.port);

        }
        else if (co.fog !== undefined) {
            var fog = new Fog(co.port);

        }
        else {
            var device = new Device(co.port);

        }

        this.setPort(this.deviceId, co.port);
        this.port = co.port;
    }
    else {
        var lr = new LocalRegistry();
        lr.init(co, dp);
        return lr;
    }

}

//==========================================
// Registration using local storage
//==========================================

var localStorage;

// Some global values that are exported by the machRegistry.

var deviceId = undefined,
    deviceAddr = undefined,
    port = undefined,
    type = undefined;

function LocalRegistry() {

    var that = this;
    this.deviceId = deviceId;
    this.deviceAddr = deviceAddr;
    this.port = port;
    this.type = type;

    this.init = function(co, dp) {
        // put the 'app' as a hidden directory in user's home
        var appdir = os.homedir() + '/.' + app
        // Set deviceId
        var deviceId = dp.getItem('deviceId');

        // Open local storage
        if (typeof localStorage === "undefined" || localStorage === null) {
            var LocalStorage = require('node-localstorage').LocalStorage;
            localStorage = new LocalStorage(appdir);
        }

        // We need to setup the device
        if (co.cloud !== undefined) {
            this.setCloud(this.deviceId);
            this.type = 'CLOUD';
        }
        else if (co.fog !== undefined) {
            this.setFog(this.deviceId);
            this.type = 'FOG';
        }
        else {
            this.setDevice(this.deviceId);
            this.type = 'DEVICE';
        }

        this.setPort(this.deviceId, co.port);
        this.port = co.port;
    }

    // insert cloud..
    //
    this.setCloud = function (devId) {

        if (devId === undefined)
            devId = deviceId;

        // get existing clouds
        clouds = localStorage.getItem('cloud');
        if (clouds !== null) {
            if (clouds !== devId)
                console.log("WARNING! Another cloud is already set.. resetting");
        }
        localStorage.setItem('cloud', devId);

        // Also store the record for the current node
        nodestr = localStorage.getItem(devId);
        if (nodestr === null)
            node = {"id": devId};
        else
            node = JSON.parse(nodestr);
        node.type = 'CLOUD';
        node.utime = Date.now();

        localStorage.setItem(devId, JSON.stringify(node));
    }

    // insert fog
    // WARNING: There could be a Race Condition here
    //
    this.setFog = function (devId) {

        if (devId === undefined)
            devId = deviceId;

        // get existing fogs
        fogstr = localStorage.getItem('fogs');
        if (fogstr !== null) {
            fogs = JSON.parse(fogstr);
            for (f in fogs) {
                if (fogs[f] === devId)
                    return;
            }
        } else
            fogs = [];

        fogs.push(devId);
        localStorage.setItem('fogs', JSON.stringify(fogs));

        // Also store the record for the current node
        nodestr = localStorage.getItem(devId);
        if (nodestr === null)
            node = {"id": devId};
        else
            node = JSON.parse(nodestr);
        node.type = 'FOG';
        node.utime = Date.now();

        localStorage.setItem(devId, JSON.stringify(node));
    }

    // insert device
    this.setDevice = function (devId) {

        if (devId === undefined)
            devId = deviceId;

        // Also store the record for the current node
        nodestr = localStorage.getItem(devId);
        if (nodestr === null)
            node = {"id": devId};
        else
            node = JSON.parse(nodestr);
        node.type = "DEVICE";
        node.utime = Date.now();
        localStorage.setItem(devId, JSON.stringify(node));
    }

    this.setPort = function (devId, port) {

       if (devId === undefined)
            devId = deviceId;

        nodestr = localStorage.getItem(devId);
        // if not found in local storage, then exit without any changes
        if (nodestr === null)
            return;
        node = JSON.parse(nodestr);
        node.port = port;
        localStorage.setItem(devId, JSON.stringify(node));
    }


    this.getAFog = function () {
        fogstr = localStorage.getItem('fogs');

        if (fogstr === null) {
            console.log("WARNING! Cannot find a fog to connect.. ");
            return undefined;
        }

        fogs = JSON.parse(fogstr);
        return pickANewerNode(fogs);
    }

    // update the address of the device
    this.update = function (devId) {

        if (devId === undefined)
            devId = deviceId;

        nodestr = localStorage.getItem(devId);
        // if not found in local storage, then exit without any changes
        if (nodestr === null)
            return;
        node = JSON.parse(nodestr);
        node.addr = getIPv4Address();
        node.utime = Date.now();
        localStorage.setItem(devId, JSON.stringify(node));
    }


    this.getURL = function (devId) {

        if (devId === undefined)
            devId = deviceId;

        nodestr = localStorage.getItem(devId);
        if (nodestr === null)
            return undefined;
        node = JSON.parse(nodestr);

        return "tcp://" + node.addr + ":" + node.port;
    }

    this.getTheCloud = function() {
        cloud = localStorage.getItem('cloud');
        if (cloud === null)
            return undefined;
        return cloud;
    }
}

//======================================
// Helpers
//======================================

function getIPv4Address() {

        var niaddrs = os.networkInterfaces();
        for (var ni in niaddrs) {
                nielm = niaddrs[ni];
                for (n in nielm) {
                        if (nielm[n].family === 'IPv4' && nielm[n].internal === false)
                                return nielm[n].address
                }
        }
        return "127.0.0.1";
}

function pickANewerNode(nds) {

    var devs = [];

    for (n in nds) {
        nodestr = localStorage.getItem(nds[n]);
        if (nodestr !== null) {
            node = JSON.parse(nodestr);
            if ((Date.now() - node.utime) < 120000)
                devs.push(nds[n]);
        }
    }

    if (devs.length == 0)
        return undefined;
    else
        return rgen.pick(devs);
}
