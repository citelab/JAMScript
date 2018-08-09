//===================================================================
// This module holds JAM configuration for the program execution
// These are general parameters like:
// Initiation pattern for concurrent functions: random, step, immediate
//===================================================================

var globals = require('./constants').globals;

var delay = globals.DelayMode.NoDelay;

module.exports = new function() {

    this.init = function() {
    }
}
