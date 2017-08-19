//===================================================================
// This module holds JAM configuration for sync execution.
// There will be only one active synchronous statement execution
// in an application. So there is no need to track the associated
// function. We reset the sync parameters at initiation of the
// function execution for each function.
//===================================================================

var globals = require('./constants').globals;

var degree = globals.allNodes;
var confirm = 1.0;

module.exports = new function() {

    this.init = function(reg, zname, mtype, nodeid) {

        reggie = reg;
        zone = zname;
        type = mtype;
        id = nodeid;

    }
}
