//==============================================================================
// Defines the Registry superclass
//==============================================================================

var EventEmitter = require('events').EventEmitter;

function Registry(app, machType, id, port) {
    this.app = app;
    this.machType = machType;
    this.id = id;
    this.port = port;
}

/* Registry inherits from EventEmitter */
Registry.prototype = Object.create(EventEmitter.prototype);
Registry.prototype.constructor = Registry;

/* exports */
module.exports = Registry;
