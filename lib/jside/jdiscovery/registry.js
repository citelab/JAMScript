//==============================================================================
// Defines the Registry superclass
//==============================================================================

var EventEmitter = require('events').EventEmitter;

function Registry(app, machType, id, port, loc) {
    this.app = app;
    this.machType = machType;
    this.id = id;
    this.port = port;
    this.loc = loc;
}

/* Registry inherits from EventEmitter */
Registry.prototype = Object.create(EventEmitter.prototype);
Registry.prototype.constructor = Registry;

/* exports */
module.exports = Registry;
