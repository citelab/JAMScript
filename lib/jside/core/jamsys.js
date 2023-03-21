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

    this.init = function(reg, mtype, tgs, nodeid, edge, long, lat) {
        this.reggie = reg;
        this.machtype = mtype;
        this.id = nodeid;
        this.tags = tgs;
        this.edge = edge;
        this.long = long;
        this.lat = lat;
        this.fogid = undefined;
        this.cloudid = undefined;
        this.milestone = undefined;
        this.milestoneCount = undefined;
        this.iteration = undefined;
        this.redis = {host: undefined, port: undefined};
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
        this.redis = {host: host, port: port};
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

    this.setMilestone = function(number) {
        if (number !== undefined || number !== null) {
            if (number == this.milestone)
                this.iteration++;
            else 
                this.milestone = number;
        }
    }

    this.setMilestoneCount = function(number) {
        if (number !== undefined || number !== null) {
            this.milestoneCount = number;
        }
    }

    this.getJAMClock = function() {
        return this.iteration * this.milestoneCount + this.milestone;
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
}
