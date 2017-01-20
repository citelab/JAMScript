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
    rgen = new Random();

var localStorage;

// Some global values that are exported by the machRegistry.

var deviceId = undefined,
    deviceAddr = undefined,
    port = undefined,
    type = undefined;

module.exports = new function () {

    var that = this;
    this.deviceId = deviceId;
    this.deviceAddr = deviceAddr;
    this.port = port;
    this.type = type;

    this.init = function (co, dp) {
        var registry = co.registry,
            app = co.app;

        if (registry) {
            // Use remote registry.. at a predefined global URL
            // TODO: This is not yet implemented.

            console.log("ERROR! Globale registry not yet implemented..\nQuiting");
            process.exit(1);
        } 
        else {
            // put the 'app' as a hidden directory in user's home
            appdir = os.homedir() + '/.' + app
            // Set deviceId
            deviceId = dp.getItem('deviceId');

            // Open local storage
            if (typeof localStorage === "undefined" || localStorage === null) {
                var LocalStorage = require('node-localstorage').LocalStorage;
                localStorage = new LocalStorage(appdir);
            }

            // We need to setup the device
            setDevice(that, co);
        }
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

function setDevice(mr, co) {

	if (co.cloud !== undefined) {
		mr.setCloud(mr.deviceId);
        mr.type = 'CLOUD';
    }
    else if (co.fog !== undefined) {
		mr.setFog(mr.deviceId);
        mr.type = 'FOG';
    }
	else {
		mr.setDevice(mr.deviceId);
        mr.type = 'DEVICE';
    }

	mr.setPort(mr.deviceId, co.port);
    mr.port = co.port;
}

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
