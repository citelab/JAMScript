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

    this.init = function(reg, mtype, tgs, ifl, ofl, nodeid, link, long, lat) {

        reggie = reg;
        this.type = mtype;
        this.id = nodeid;
        this.tags = tgs;
        this.iflow = ifl;
        this.oflow = ofl;
        this.link = link;
        this.long = long;
        this.lat = lat;
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

    this.setLong = function(val) {
        this.long = val;
    }

    this.setLat = function(val) {
        this.lat = val;
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

    // Advertise the given attribute as on
    this.adUp = function(aname, info) {
        var attr = {};
        attr[aname] = info;

        if (advertised.get(aname) === undefined) {
            advertised.set(aname, 1);
            this.setupAdvertisement(aname);
        }

        reggie.setAttributes(attr);
    }

    // Advertise aname off
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

}
