const   EventEmitter = require('events'),
        cp = require('child_process');

/**
 * Registrar Class
 *      This class is the interface between the application
 *      and the MQTT, mDNS registries
 */

function RegistrarHead(app, type, id, port, config) {
    
    this.registrarAbdomen = cp.fork('./jregistrar-abdomen.js', [app, type, id, port, config]);

    let self = this;
    registrarAbdomen.on('message', (m) => {
        // TODO
        self.emit(...);
    }
}

/* Registrar inherits from EventEmitter */
RegistrarHead.prototype = Object.create(EventEmitter.prototype);
RegistrarHead.prototype.constructor = RegistrarHead;

/**
 * REGISTRAR INTERFACE METHODS
 * __JDISCOVERY_EXTERNAL_API__
 */

/**
 * Register a node on the network, and discover other nodes.
 * `options` is an optional parameter
 * `options` include:
 *   attrsToSet: key/value pair as in this.setAttributes
 *   attrsToDiscover: as in this.discoverAttributes
 */
RegistrarHead.prototype.registerAndDiscover = function(options) {
    this.registrarAbdomen.send({ registerAndDiscover : options });
}

/**
 * Add custom, discoverable attributes to this node
 * attrs is an object of key value pairs
 */
RegistrarHead.prototype.setAttributes = function(attrs) {
    this.registrarAbdomen.send({ setAttributes : attrs });
}
RegistrarHead.prototype.removeAttributes = function(attrs) {
    this.registrarAbdomen.send({ removeAttributes : attrs });
}

/**
 * Specify attributes to be discovered.
 * dattrs can have one of the following forms:
 * (a)
 *    {
 *        all: {attr: event, ...}, // discover these attributes for all nodes
 *        device: {attr: event, ...}, // discover these attributes just for devices
 *        fog: {attr: event, ...}, // discover these attributes just for fogs
 *        cloud: {attr: event, ...} // discover these attributes just for clouds
 *    }
 * (b) As a shortcut for _all_, one can simply pass an object of <attr, event> pairs
 *
 * For the status attribute, the format is:
 *      status: {
 *          online: 'fog-up',
 *          offline: 'fog-down'
 *      }
 * Whereas for custom attributes, the format is:
 *      is_a_phone: {
 *          onAdd: 'phone-found'
 *          onRemove: 'phone-lost'
 *      }
 */
RegistrarHead.prototype.discoverAttributes = function(dattrs) {
    this.registrarAbdomen.send({ discoverAttributes : dattrs });
}
RegistrarHead.prototype.stopDiscoveringAttributes = function(dattrs) {
    this.registrarAbdomen.send({ stopDiscoveringAttributes : dattrs });
}

/* exports */
module.exports = RegistrarHead;
