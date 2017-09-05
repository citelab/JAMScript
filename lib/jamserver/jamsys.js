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

module.exports = new function() {

    this.init = function(reg, mtype, nodeid) {

        reggie = reg;
        this.type = mtype;
        this.id = nodeid;
    }


    this.updateCoords = function(coords) {

    }

    // return the machine type.. this value does not change
    // return the current zone value

    // Advertise redis from Fog to devices
    this.putRedis = function(ip, port) {

    }

    // Pull the advertisements from the devices.
    // This sets up a subscription that will get fullfilled
    this.getRedis = function() {

    }

    // TODO: Do we need to use this for flow advertisements?
    // Flow advertisements are inside a fog node or may be inside
    // a virtual fog node. Do we need this mechanism or should there
    // be a separate one that is much faster in terms of discovery time?

}
