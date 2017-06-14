//==============================================================================
// Registers a node locally (using local storage)
//==============================================================================

var constants = require('./constants'),
    logger = require('./jerrlog'),
    registrar = require('./registrar');

/* create an mDNS advertisement on the local network */

function LocalRegistrar(app, machType, port, id) {
    this.app = app;
    this.machType = machType;
    this.port = port;
    this.id = id;
    // TODO: pass this in from MDNSRegistrar
    this.ip = this._getIPv4Address();
}

/* LocalRegistrar inherits from Registrar */
LocalRegistrar.prototype = new registrar.Registrar();



// Modify

function LocalRegistry() {

    var that = this;
    this.deviceId = deviceId;
    this.deviceAddr = deviceAddr;
    this.port = port;
    this.type = type;

    this.init = function(co, dp) {
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
