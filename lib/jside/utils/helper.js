'use strict';
const   globals = require('./constants').globals,
        mqttconsts = require('./constants').mqtt,
        JAMP = require('./jamprotocol'),
        deviceParams = require('./deviceparams'),
        mqtt = require('mqtt'),
        cbor = require('cbor-x'),
        os = require('os');

/* 
 * Returns true if the current node is the root of the execution hierarchy.
 * If the cloud is connected, it the root. Otherwise the highest node (fog or device)
 * is the root. We could also force the root to be elsewhere using JCond restrictions.
 * That is, with a cloud connection, we could have the fog as the root.
 */
exports.iamRoot = function(core, n) {
    switch (n & 0x7) {
        case 0:
            if (core.machtype == globals.NodeType.CLOUD)
                return true;
            if (core.machtype == globals.NodeType.FOG && core.cserv === null)
                return true;
            if (core.machtype == globals.NodeType.DEVICE && core.cserv === null && core.fserv === null)
                return true;
        break;
        case 1:
            if (core.machtype == globals.NodeType.DEVICE)
                return true;
        break;
        case 2:
            if (core.machtype == globals.NodeType.FOG)
                return true;
        break;
        case 4:
            if (core.machtype == globals.NodeType.CLOUD)
                return true;
        break;
    }
    return false;
}

exports.repeatPing = function repeatPing(mqtt, cmdOpts, period) {
    var tmsg = JAMP.createPingReq();
    var encode = cbor.encode(tmsg);
    mqtt.publish('/' + cmdOpts.app + '/announce/down', encode);
    setTimeout(repeatPing, period, mqtt, cmdOpts, period);
}

exports.setMQTTSubscriptions = function(mqtt, cmdOpts) {
    mqtt.subscribe('/' + cmdOpts.app + '/announce/up');
    mqtt.subscribe('/' + cmdOpts.app + '/requests/up');
    mqtt.subscribe('/' + cmdOpts.app + '/replies/up');
    mqtt.subscribe('/' + cmdOpts.app + '/replies/down');
}

exports.setMQTTSubscriptions_aux = function(mqtt, cmdOpts) {
    mqtt.subscribe('/' + cmdOpts.app + '/announce/up');
    mqtt.subscribe('/' + cmdOpts.app + '/requests/up');
    mqtt.subscribe('/' + cmdOpts.app + '/replies/up');
    mqtt.subscribe('/' + cmdOpts.app + '/replies/down');    
    mqtt.subscribe('/' + cmdOpts.app + '/requests/down/j');
}

const copts = {
    clientId: deviceParams.getItem('deviceId'),
    keepalive: mqtt.keepAlive,
    clean: false,
    connectTimeout: mqtt.connectionTimeout,
}

exports.mqttConnect = function(ip, port) {
    return mqtt.connect("tcp://" + ip + ":" + port, copts);
}

exports.getURL = function(ip, port) {
    return "tcp://" + ip + ":" + port;
}

exports.getMachineType = function(copts) {
    let machType = null;
    if (copts.device) {
        machType = globals.NodeType.DEVICE;
    } else if (copts.fog) {
        machType = globals.NodeType.FOG;
    } else if (copts.cloud) {
        machType = globals.NodeType.CLOUD;
    } else {
        throw new 
        Error('no machine type specified - must be one of \'device\', \'fog\', or \'cloud\'');
    }
    return machType;
}

exports.getMachineAddr = function() {
    let n = null;
    let niaddrs = os.networkInterfaces();
    for (var ni in niaddrs) {
        let nielm = niaddrs[ni];
        for (n in nielm) {
            if (nielm[n].family === 'IPv4' && nielm[n].internal === false)
                return nielm[n].address
        }
    }
    return globals.localhost;
}

exports.minMachineLevel = function(mlevel, mtype) {
    if ((mlevel === undefined) ||
    (mlevel === 4 && mtype === globals.NodeType.CLOUD) ||
    (mlevel === 2 && mtype === globals.NodeType.FOG) ||
    (mlevel === 1 && mtype === globals.NodeType.DEVICE))
        return true;
    return false;
}

exports.validClock = function(aarg, bc) {
    if (aarg === '-')
        return true;
    var arr = aarg.split('|');
    var rclock = parseFloat(arr[1], 10);
    var barr = arr[0].split(',');
    var mclock = 0.0;
    barr.forEach(function(b) {
        var tclock = parseFloat(bc[b].getClock());
        if (tclock > mclock)
            mclock = tclock;
    });
    if (rclock <= mclock)
        return true;
    else
        return false;
}

exports.checkArgsType = function(args, mask) {
    var m;
    if (args.length !== mask.length)
        return false;
    for (m in mask) {
        switch (mask[m]) {
            case 's':
                if (typeof(args[m]) !== 'string')
                    return false;
                break;
            case 'i':
                if (typeof(args[m]) !== 'number')
                    return false;
                break;
        }
    }
    return true;
}

/* 
 * Returns the distance measure between Geo-Coords 1 and 2.
 * Both in longitude and latitude format.
 */
exports.geo2Distance = function(lon1, lat1, lon2, lat2) {
    var R = 6378.137;                   // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c;
    return d * 1000;                    // meters
}


exports.parse = function(msg) {
    if ((typeof msg) === 'string')
        return JSON.parse(msg);
    else 
        return msg;
}