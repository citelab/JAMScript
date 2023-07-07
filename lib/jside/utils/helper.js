'use strict';
const   globals = require('./constants').globals,
        JAMP = require('./jamprotocol'),
        cbor = require('cbor-x'),
        os = require('os');


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


exports.getMachineType = function(copts) {
    let machType = null;
    if (copts.device) {
        machType = globals.NodeType.DEVICE;
    } else if (copts.fog) {
        machType = globals.NodeType.FOG;
    } else if (copts.cloud) {
        machType = globals.NodeType.CLOUD;
    } else if (copts.local_registry) {
        machType = globals.NodeType.LOCAL_REGISTRY;
    } else if (copts.global_registry) {
        machType = globals.NodeType.GLOBAL_REGISTRY;
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


/*
 * Returns the distance measure between Geo-Coords 1 and 2.
 * Both in longitude and latitude format.
 */

// TODO: use     dist = math.acos(math.sin(lat1) * math.sin(lat2) + math.cos(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)) * R
// way simpler
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

exports.geo2DistanceLoc = function(loc1, loc2) {
    return exports.geo2Distance(loc1.long, loc1.lat, loc2.long, loc2.lat);
}


exports.parse = function(msg) {
    if ((typeof msg) === 'string')
        return JSON.parse(msg);
    else
        return msg;
}