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

function setup_advertise(mtype, aname) {

    var fup = 'fog-' + aname + '-up';
    var fdown = 'fog-' + aname + '-down';
    var cup = 'cloud-' + aname + '-up';
    var cdown = 'cloud-' + aname + '-down';

    var fobj = {};
    fobj[aname] = {onAdd: fup, onRemove: fdown};

    var cobj = {};
    cobj[aname] = {onAdd: cup, onRemove: cdown};

    if (mtype === globals.NodeType.DEVICE)
        reggie.discoverAttributes({fog: fobj, cloud: cobj});
    else if (mtype === globals.NodeType.FOG)
        reggie.discoverAttributes({cloud: cobj});
}


module.exports = new function() {

    this.init = function(reg, mtype, tgs, nodeid) {

        reggie = reg;
        this.type = mtype;
        this.id = nodeid;
        this.tags = tgs;
    }

    // Advertise redis on
    this.ad_up = function(aname, info) {
        var attr = {};
        attr[aname] = info;

        if (advertised.get(aname) === undefined) {
            advertised.set(aname, 1);
            setup_advertise(this.type, aname);
        }

        reggie.addAttributes(attr);
    }

    // Advertise redis off
    this.ad_down = function(aname) {
        reggie.removeAttributes(aname);
    }

    this.ad_up_fogcback = function(aname, cback) {
        var fup = 'fog-' + aname + '-up';

        if (cback !== undefined)
            reggie.on(fup, function (id, info) {
                cback(info);
            });
    }

    this.ad_down_fogcback = function(aname, cback) {
        var fdown = 'fog-' + aname + '-down';

        if (cback !== undefined)
            reggie.on(fdown, function(id, info) {
                cback(info);
            });
    }

    this.ad_up_cloudcback = function(aname, cback) {
        var cup = 'cloud-' + aname + '-up';

        if (cback !== undefined)
            reggie.on(cup, function(id, info) {
                cback(info);
            });
    }

    this.ad_down_cloudcback = function(aname, cback) {
        var cdown = 'cloud-' + aname + '-down';

        if (cback !== undefined)
            reggie.on(cdown, function(id, info) {
                cback(info);
            });
    }

    this.fog_data_up = function(cback) {
        this.ad_up_fogcback('datadepot', cback);
    }

    this.cloud_data_up = function(cback) {
        this.ad_up_cloudcback('datadepot', cback);
    }
}
