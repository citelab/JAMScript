//===================================================================
// This module hold JAM system state. So the "runtime" state of
// JAM virtual machine is captured by this module.
// We can inspect or even change the state using the functions
// provided here.
//
// These functions are quite handy.
//===================================================================
var globals = require('./constants').globals;

var reggie = undefined;
var zone =  undefined;
var type = undefined;
var id = undefined;

module.exports = new function() {

    this.init = function(reg, zname, mtype, nodeid) {

        reggie = reg;
        zone = zname;
        type = mtype;
        id = nodeid;

        // Add the attribute.. if the type is fog
        var attrobj = {};
        attrobj[zone] = id;
        if (type === globals.NodeType.FOG)
            reggie.addAttributes(attrobj);

        // Discover attribute.. if the type is device
        var dattrobj = {};
        dattrobj[zone] = 'zoneinfo';
        if (type === globals.NodeType.DEVICE)
            reggie.discoverAttributes({
                fog: dattrobj
            });
    }

    this.currZone = function() {
        // return the current zone value
        return zone;
    }

    this.changeZone = function(newzone) {

        // In the Fog..
        if (type === globals.NodeType.FOG) {
            // Remove the current zone attribute
            reggie.removeAttributes(zone);
            var attrobj = {};
            attrobj[newzone] = id;
            reggie.addAttributes(attrobj);
        }

        if (type === globals.NodeType.DEVICE) {

            // Stop discovery on the old zone..
            reggie.stopDiscoveringAttributes({fog: [zone]});

            var dattrobj = {};
            dattrobj[newzone] = 'zoneinfo';
            reggie.discoverAttributes({
                fog: dattrobj
            });
        }

        zone = newzone;
    }

    this.machType = function() {
        // return the machine type.. this value does not change
        return type;
    }

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
