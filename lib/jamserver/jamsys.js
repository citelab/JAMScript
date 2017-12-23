//===================================================================
// This module holds JAM system state. So the "runtime" state of
// JAM virtual machine is captured by this module.
// We can inspect or even change the state using the functions
// provided here.
//
// These functions are quite handy.
//===================================================================
var globals = require('./constants').globals;

var reggie = undefined;
var advertised = new Map();
var fogid,
    cloudid;

var redserver,
    redport,
    mqttserver,
    mqttport;

module.exports = new function() {

    this.init = function(reg, mtype, tgs, nodeid) {

        reggie = reg;
        this.type = mtype;
        this.id = nodeid;
        this.tags = tgs;
    }

    this.fullid = function() {
        return this.id + "_" + this.type;
    }

    this.setFog = function(fid) {
        if (fogid === undefined)
            fogid = fid;
    }

    this.setCloud = function(cid) {
        if (cloudid === undefined)
            cloudid = cid;
    }

    this.setRedis = function(host, port) {
        redserver = host;
        redport = port;
    }

    this.setMQTT = function(host, port) {
        mqttserver = host;
        mqttport = port;
    }

    this.getMQTT = function() {
        return {host: mqttserver, port: mqttport};
    }

    this.getRedis = function() {
        if (redserver === undefined)
            return undefined;
        else
            return {host: redserver, port: redport};
    }

    this.unsetFog = function(fid) {
        if (fogid !== fid)
            fogid = undefined;
    }

    this.unsetCloud = function(cid) {
        if (cloudid !== cid)
            cloudid = undefined;
    }

    // Advertise redis on
    this.adUp = function(aname, info) {
        var attr = {};
        attr[aname] = info;

        if (advertised.get(aname) === undefined) {
            advertised.set(aname, 1);
            this.setupAdvertisement(aname);
        }

        reggie.addAttributes(attr);
    }

    // Advertise redis off
    this.adDown = function(aname) {
        reggie.removeAttributes(aname);
    }

    this.setupAdvertisement = function(aname) {

        console.log("Setup advertisement... ");

        var fup = 'fog-' + aname + '-up';
        var fdown = 'fog-' + aname + '-down';
        var cup = 'cloud-' + aname + '-up';
        var cdown = 'cloud-' + aname + '-down';

        var fobj = {};
        fobj[aname] = {onAdd: fup, onRemove: fdown};

        var cobj = {};
        cobj[aname] = {onAdd: cup, onRemove: cdown};

        if (this.type === globals.NodeType.DEVICE) {
            reggie.discoverAttributes({fog: fobj, cloud: cobj});
        }
        else if (this.type === globals.NodeType.FOG) {
            reggie.discoverAttributes({cloud: cobj});
        }
    }

    this.adUpFogcback = function(aname, cback) {
        var fup = 'fog-' + aname + '-up';

        if (cback !== undefined)
            reggie.on(fup, function (id, info) {
                if (id === fogid) {
                    console.log('============FOG UP====+???????================', id, info);
                    cback(info);
                }
            });
    }

    this.adDownFogcback = function(aname, cback) {
        var fdown = 'fog-' + aname + '-down';

        if (cback !== undefined)
            reggie.on(fdown, function(id, info) {
                console.log('==========FOG DOWN======+???????================', id, info);
                cback(info);
            });
    }

    this.adUpCloudcback = function(aname, cback) {
        var cup = 'cloud-' + aname + '-up';

        if (cback !== undefined)
            reggie.on(cup, function(id, info) {
                if (id === cloudid) {
                    console.log('===========CLOUD UP=====+???????================', id, info);
                    cback(info);
                }
            });
    }

    this.adDownCloudcback = function(aname, cback) {
        var cdown = 'cloud-' + aname + '-down';

        if (cback !== undefined)
            reggie.on(cdown, function(id, info) {
                console.log('===========CLOUD DOWN=====+???????================', id, info);
                cback(info);
            });
    }

    this.fogDataUp = function(cback) {
        this.adUpFogcback('datadepot', cback);
    }

    this.cloudDataUp = function(cback) {
        this.adUpCloudcback('datadepot', cback);
    }
}
