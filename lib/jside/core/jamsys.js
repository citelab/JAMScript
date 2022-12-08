//===================================================================
// This module holds JAM system state. So the "runtime" state of
// JAM virtual machine is captured by this module.
// We can inspect or even change the state using the functions
// provided here.
//
// These functions are quite handy.
//===================================================================
var globals = require('../utils/constants').globals,
    advertised = new Map();

module.exports = new function() {

    this.init = function(reg, mtype, tgs, nodeid, link, long, lat) {
        this.reggie = reg;
        this.machtype = mtype;
        this.id = nodeid;
        this.tags = tgs;
        this.link = link;
        this.long = long;
        this.lat = lat;
        this.fogid = undefined;
        this.cloudid = undefined;
        this.redis = {server: undefined, port: undefined};
        this.mqtt = {server: undefined, port: undefined};
    }

    this.fullid = function() {
        return this.id + "_" + this.type;
    }

    this.setFog = function(fid) {
        if (this.fogid === undefined)
            this.fogid = fid;
    }

    this.setCloud = function(cid) {
        if (this.cloudid === undefined)
            this.cloudid = cid;
    }

    this.setRedis = function(host, port) {
        this.redis = {server: host, port: port};
    }

    this.setLong = function(val) {
        if (val !== undefined || val !== null)
            this.long = val;
    }

    this.setLat = function(val) {
        if (val !== undefined || val !== null)
            this.lat = val;
    }

    this.setLoc = function(val) {
        if (val !== undefined || val !== null) {
            this.lat = val.lat;
            this.long = val.long;
        }
    }

    this.setMQTT = function(host, port) {
        this.mqtt = {server: host, port: port};
    }

    this.getMQTT = function() {
        return this.mqtt;
    }

    this.getRedis = function() {
        return this.redis;
    }

    this.unsetFog = function(fid) {
        if (this.fogid !== fid)
            this.fogid = undefined;
    }

    this.unsetCloud = function(cid) {
        if (this.cloudid !== cid)
            this.cloudid = undefined;
    }

    // Advertise the given attribute as on
    this.adUp = function(aname, info) {
        var attr = {};
        attr[aname] = info;

        if (advertised.get(aname) === undefined) {
            advertised.set(aname, 1);
            this.setupAdvertisement(aname);
        }

        this.reggie.addAttributes(attr);
    }

    // Advertise aname off
    this.adDown = function(aname) {
        this.reggie.removeAttributes(aname);
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
            this.reggie.discoverAttributes({fog: fobj, cloud: cobj});
        }
        else if (this.type === globals.NodeType.FOG) {
            this.reggie.discoverAttributes({cloud: cobj});
        }
    }

}
