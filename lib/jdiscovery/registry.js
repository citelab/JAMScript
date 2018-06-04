//==============================================================================
// Defines the Registry superclass
//==============================================================================

var EventEmitter = require('events').EventEmitter,
    constants = require('../jamserver/constants');

function Registry(app, type, id, port) {
    this.app = app;
    this.type = type;
    this.id = id;
    this.port = port;
}

/* Registry inherits from EventEmitter */
Registry.prototype = Object.create(EventEmitter.prototype);
Registry.prototype.constructor = Registry;

/* exports */
module.exports = Registry;
