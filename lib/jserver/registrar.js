//==============================================================================
// Defines the registrar superclass
//==============================================================================

var events = require('events'),
    os = require('os'),
    constants = require('./constants');

function Registrar(ip, port) {
    this.ip = ip;
    this.port = port;
}

/* Registrar inherits from even emitter */
Registrar.prototype = new events.EventEmitter();

/**
 * returns the IPv4 address of the node
 */
Registrar.prototype._getIPv4Address = function() {
    var niaddrs = os.networkInterfaces();
    for (var ni in niaddrs) {
        nielm = niaddrs[ni];
        for (n in nielm) {
            if (nielm[n].family === 'IPv4' && nielm[n].internal === false)
                return nielm[n].address
        }
    }
    return contants.globals.localhost;
}

/**
 * returns the url the node can be accessed on
 */
Registrar.prototype._getUrl = function() {
    return 'tcp://' + this.ip + ':' + this.port;
}

/* exports */
module.exports.Registrar = Registrar;
