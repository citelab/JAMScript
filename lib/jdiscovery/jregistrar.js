var EventEmitter = require('events'),
    globals = require('../jamserver/constants').globals,
    constants = require('../jamserver/constants'),
    MQTTRegistry = require('./mqttregistry'),
    MDNSRegistry = require('./mdnsregistry'),
    os = require('os');

//==============================================================================
// Helpers
//==============================================================================

/**
 * returns the IPv4 address of the node
 */
function getIPv4Address() {
    var niaddrs = os.networkInterfaces();
    for (var ni in niaddrs) {
        nielm = niaddrs[ni];
        for (n in nielm) {
            if (nielm[n].family === 'IPv4' && nielm[n].internal === false)
                return nielm[n].address
        }
    }
    return globals.localhost;
}

//==============================================================================
// Registrar Class
// This class is the interface between the application
// and the MQTT, mDNS registries
//==============================================================================

function Registrar(app, machType, id, port, config) {
    // the name of the application
    this.app = app;
    // the type of the machine the registar is running on (device, fog, or cloud)
    this.machType = machType;
    // the id of the machine
    this.id = id;
    // the port the program is running on
    if (typeof port === 'string') {
        port = parseInt(port);
    }
    if (!(typeof port === 'number')) {
        throw new Error('port is not a number');
    }
    this.port = port;

    /*
     * Store discoveries so that we can easily check for duplicates.
     * discoveries is an object which maps from an attribute name, e.g. 'status' to
     * a map of <node ID, message ID> pairs. e.g. if discoveries looks like:
     *  {
     *      status: {
     *          a: 123,
     *          b: 456
     *      }
     *  }
     * then we know that the last message received from node 'a' regarding the
     * 'attribute' status had ID 123.
     */
    this.discoveries = {};

    /**
     * Reserved attributes.
     * These are attribute names that cannot be used by third parties.
     */
    this.reservedAttrs = ['status', 'lastCheckIn', 'createdAt', 'updatedAt'];

    // whether or not this registrar has been started
    this.started = false;

    /**
     * config-specific set-up
     */

    var noProtocols = true;

    if (!config || !config.protocols || config.protocols.mqtt) {
        // QoS |1| for MQTT: Message delivery is __AT_LEAST_ONCE__
        var subQos = 1,
            pubQos = 1;
        this.mqttRegistry = new MQTTRegistry(app, machType, id, port, subQos, pubQos);
        noProtocols = false;
    }

    if (!config || !config.protocols || config.protocols.mdns) {
        this.mdnsRegistry = new MDNSRegistry(app, machType, id, port);
        noProtocols = false;
    }

    if (noProtocols) {
        throw new Error('a Registrar must use at least one protocol');
    }

    if (config && config.hasOwnProperty('eliminateDuplicates')) {
        this.eliminateDuplicates = config.eliminateDuplicates;
    } else {
        // by default, eliminate duplicates
        this.eliminateDuplicates = true;
    }

    /**
     * Set up default attributes, which are the same for devices, fogs, and clouds.
     * The only default attribute is 'status'.
     */
    this.addAttributes({
        status: function() {
            return {
                port: port,
                ip: getIPv4Address()
            };
        }
    }, true);

    /**
     * Prep the default discoveries to be made by a node:
     * devices discover fogs and fogs discover clouds.
     */
    if (this.machType === globals.NodeType.DEVICE) {
        // default discoveries:
        // devices discover fogs
        this.discoverAttributes({
            fog: {
                status: {
                    online: 'fog-up',
                    offline: 'fog-down'
                    // if the status value is `offline`, then we emit fog-down, else we emit fog-up
                }
            },
            cloud: {
                status: {
                    online: 'cloud-up',
                    offline: 'cloud-down'
                }
            }
        });
    } else if (this.machType === globals.NodeType.FOG) {
        // default discoveries:
        // fogs discover clouds
        this.discoverAttributes({
            cloud: {
                status: {
                    online: 'cloud-up',
                    offline: 'cloud-down'
                }
            }
        });
    } else {
        // If this node is a cloud, then it discovers nothing by default!
    }

    // listen for events from the Registries
    var self = this;

    if (this.mqttRegistry) {
        this.mqttRegistry.on('sub-error', function(dattrs) {
            setTimeout(self.mqttRegistry.subscribe, constants.mqtt.longRetryInterval, self.mqttRegistry, dattrs);
        });

        this.mqttRegistry.on('subs-denied', function(dattrs) {
            var err = new Error('MQTT subscriptions denied');
            err.name = 'permissions_err';
            err.value = dattrs;
            self.emit('error', err);
        });

        this.mqttRegistry.on('unsub-error', function(dattrs) {
            setTimeout(self.mqttRegistry.unsubscribe, constants.mqtt.longRetryInterval, self.mqttRegistry, dattrs);
        });

        this.mqttRegistry.on('pub-error', function(attr, value) {
            setTimeout(self.mqttRegistry.publish, constants.mqtt.longRetryInterval, self.mqttRegistry, attr, value);
        });

        this.mqttRegistry.on('unpub-error', function(attr) {
            setTimeout(self.mqttRegistry.unpublish, constants.mqtt.longRetryInterval, self.mqttRegistry, attr);
        });

        this.mqttRegistry.on('discovery', function(attr, event, nodeId, value, dedupeId) {
            self._respondToDiscoveryEvent(self, attr, event, nodeId, value, dedupeId, constants.globals.Protocol.MQTT);
        });

        this.mqttRegistry.on('attr-removed', function(attr, event, nodeId) {
            self._respondToAttrRemovalEvent(self, attr, event, nodeId, constants.globals.Protocol.MQTT);
        });
    }

    if (this.mdnsRegistry) {
        this.mdnsRegistry.on('ad-error', function(attr, adName, txtRecord) {
            // an ad failed - try again after some time
            setTimeout(self.mdnsRegistry._createAdvertisementWithRetries, constants.mdns.longRetryInterval, self.mdnsRegistry, attr, adName, txtRecord, 0);
        });

        this.mdnsRegistry.on('browser-error', function(attr, machType, events) {
            // a browser failed - try again after some time
            if (attr === 'status') {
                setTimeout(self.mdnsRegistry._browseForStatus, constants.mdns.longRetryInterval, self.mdnsRegistry, machType, events);
            } else {
                setTimeout(self.mdnsRegistry._browse, constants.mdns.longRetryInterval, self.mdnsRegistry, attr, machType, events);
            }
        });

        this.mdnsRegistry.on('discovery', function(attr, event, nodeId, value, dedupeId) {
            self._respondToDiscoveryEvent(self, attr, event, nodeId, value, dedupeId, constants.globals.Protocol.MDNS);
        });

        this.mdnsRegistry.on('attr-removed', function(attr, event, nodeId) {
            self._respondToAttrRemovalEvent(self, attr, event, nodeId, constants.globals.Protocol.MDNS);
        });
    }
}

/* Registrar inherits from EventEmitter */
Registrar.prototype = Object.create(EventEmitter.prototype);
Registrar.prototype.constructor = Registrar;

//==============================================================================
// API
//==============================================================================

/**
 * Register a node on the network, and discover other nodes.
 * `options` is an optional parameter
 * `options` include:
 *   attrsToAdd: key/value pair as in this.addAttributes
 *   attrsToDiscover: as in this.discoverAttributes
 */
Registrar.prototype.registerAndDiscover = function(options) {
    if (options) {
        if (typeof options !== 'object') {
            throw new Error('options must be an object - see the docs');
        }

        if (options.attrsToAdd) {
            this.addAttributes(options.attrsToAdd);
        }

        if (options.attrsToDiscover) {
            this.discoverAttributes(options.attrsToDiscover);
        }
    }

    if (!this.started) {
        if (this.mqttRegistry) {
            this.mqttRegistry.registerAndDiscover();
        }
        if (this.mdnsRegistry) {
            this.mdnsRegistry.registerAndDiscover();
        }
        this.started = true;
    }
}

/**
 * Upon receipt of an attribute removal event, pass it onto the rest of the application if it
 * is something we don't already know
 */
Registrar.prototype._respondToAttrRemovalEvent = function(self, attr, event, nodeId, protocol) {
    if (self.eliminateDuplicates && (!self.discoveries.hasOwnProperty(attr) || !self.discoveries[attr].hasOwnProperty(nodeId))) {
        return;
    }
    delete self.discoveries[attr][nodeId];
    self.emit(event, nodeId, protocol);
}

//==============================================================================
// Add and discover attributes
//==============================================================================

/**
 * Add custom, discoverable attributes to this node
 * attrs is an object of key value pairs
 */
Registrar.prototype.addAttributes = function(attrs, override) {
    // error handling
    if (!override) {
        this._checkFormOfAttrsToAdd(attrs);
    }
    // use the time corresponding to the publication of these attributes as the message ID
    const dedupeId = Date.now();
    // add the attributes on each protocol
    if (this.mqttRegistry) {
        this.mqttRegistry.addAttributes(attrs, dedupeId);
    }
    if (this.mdnsRegistry) {
        this.mdnsRegistry.addAttributes(attrs, dedupeId);
    }
}

Registrar.prototype.removeAttributes = function(attrs) {
    // error handling
    attrs = this._reformatAttrsToRemove(attrs);
    // remove the attributes on each protocol
    if (this.mqttRegistry) {
        this.mqttRegistry.removeAttributes(attrs);
    }
    if (this.mdnsRegistry) {
        this.mdnsRegistry.removeAttributes(attrs);
    }
}

/**
 * Specify attributes to be discovered.
 * dattrs can have one of the following forms:
 * (a)
 *    {
 *        all: {attr: event}, // discover these attributes for all nodes
 *        device: {attr: event}, // discover these attributes just for devices
 *        fog: {attr: event}, // discover these attributes just for fogs
 *        cloud: {attr: event} // discover these attributes just for clouds
 *    }
 * (b) As a shortcut for all, one can simply pass an object of <attr, event> pairs
 */
Registrar.prototype.discoverAttributes = function(dattrs) {
    dattrs = this._checkAndReformatAttrsToDiscover(dattrs);
    if (this.mqttRegistry) {
        this.mqttRegistry.discoverAttributes(dattrs);
    }
    if (this.mdnsRegistry) {
        this.mdnsRegistry.discoverAttributes(dattrs);
    }
}

Registrar.prototype.stopDiscoveringAttributes = function(dattrs) {
    dattrs = this._checkAndReformatAttrsToStopDiscovering(dattrs);
    if (this.mqttRegistry) {
        this.mqttRegistry.stopDiscoveringAttributes(dattrs);
    }
    if (this.mdnsRegistry) {
        this.mdnsRegistry.stopDiscoveringAttributes(dattrs);
    }
}

//==============================================================================
// Helpers
//==============================================================================

/**
 * Checks the format of a set of attributes to discover, and reformats them into the form accepted
 * by the three registries
 */
Registrar.prototype._checkAndReformatAttrsToDiscover = function(attrs) {
    // error handling
    if (typeof attrs !== 'object') {
        throw new Error('you must specify the attributes you want discovered as an object - see the docs');
    }
    // check that the attrs parameter is properly formed
    var formedAttrs;
    if (attrs.all === undefined &&
        attrs.device === undefined &&
        attrs.fog === undefined &&
        attrs.cloud === undefined) {
            this._checkFormOfAttrsToDiscover(attrs);
            formedAttrs = {
                device: {},
                fog: {},
                cloud: {}
            };
            for (var key in attrs) {
                formedAttrs.device[key] = attrs[key];
                formedAttrs.fog[key] = attrs[key];
                formedAttrs.cloud[key] = attrs[key];
            }
    } else {
        this._checkFormOfAttrsToDiscover(attrs.all);
        this._checkFormOfAttrsToDiscover(attrs.device);
        this._checkFormOfAttrsToDiscover(attrs.fog);
        this._checkFormOfAttrsToDiscover(attrs.cloud);
        for (var key in attrs.all) {
            attrs.device[key] = attrs.all[key];
            attrs.fog[key] = attrs.all[key];
            attrs.cloud[key] = attrs.all[key];
        }
        formedAttrs = attrs;
    }
    return formedAttrs;
}

Registrar.prototype._checkAndReformatAttrsToStopDiscovering = function(dattrs) {
    // error handling
    if (!(dattrs instanceof Object) && !(dattrs instanceof Array)) {
        throw new Error('you must specify the attributes to stop discovering in an object or array - see the docs');
    }

    // check that the attrs parameter is properly formed
    var formedDattrs;
    if (dattrs instanceof Array) {
        formedDattrs = {
            device: [],
            fog: [],
            cloud: []
        };
        for (var i = 0; i < dattrs.length; i++) {
            if (typeof dattrs[i] != 'string') {
                throw new Error('the attribute \'' + dattrs[i] + '\' is not a string');
            }
            formedDattrs.device.push(dattrs[i]);
            formedAttrs.fog.push(dattrs[i]);
            formedAttrs.cloud.push(dattrs[i]);
        }
    } else {
        if (dattrs.all) {
            this._checkArrayOfStrings(dattrs.all);
        }
        if (dattrs.device) {
            this._checkArrayOfStrings(dattrs.device);
        }
        if (dattrs.fog) {
            this._checkArrayOfStrings(dattrs.fog);
        }
        if (dattrs.cloud) {
            this._checkArrayOfStrings(dattrs.cloud);
        }
        if (dattrs.all) {
            for (var i = 0; i < dattrs.all.length; i++) {
                dattrs.device.push(dattrs.all[i]);
                dattrs.fog.push(dattrs.all[i]);
                dattrs.cloud.push(dattrs.all[i]);
            }
        }
        formedDattrs = dattrs;
    }
    return formedDattrs;
}

Registrar.prototype._checkArrayOfStrings = function(arr) {
    if (!(arr instanceof Array)) {
        throw new Error('attributes to stop discovering must be passed as an array of strings');
    }

    for (var i = 0; i < arr.length; i++) {
        if (typeof arr[i] != 'string') {
            throw new Error('the attribute \'' + arr[i] + '\' is not a string');
        }
    }
}

/**
 * A helper for Registrar.prototype.discoverAttributes;
 * ensures that attrs is an object of <string, string> pairs
 */
Registrar.prototype._checkFormOfAttrsToDiscover = function(attrs) {
    for (var key in attrs) {
        if (key == 'status') {
            // ensure that online and offline events are specified
            if (!attrs.status instanceof Object) {
                throw new Error('discovery of the status attribute requires \'online\' and \'offline\' event names, passed in an object - see the docs');
            }

            // online
            if (!attrs.status.hasOwnProperty('online')) {
                throw new Error('\'online\' event required for discovery of status attribute');
            } else {
                if (typeof attrs.status.online != 'string') {
                    throw new Error('the event name \'' + attrs.status.online + '\' must be a string');
                }
            }

            // offline
            if (!attrs.status.hasOwnProperty('offline')) {
                throw new Error('\'offline\' event required for discovery of status attribute');
            } else {
                if (typeof attrs.status.offline != 'string') {
                    throw new Error('the event name \'' + attrs.status.offline + '\' must be a string');
                }
            }
        } else {
            // ensure that onAdd and onRemove events are specified
            if (!attrs[key] instanceof Object) {
                throw new Error('discovery of an attribute requires \'onAdd\' and \'onRemove\' event names, passed in an object - see the docs');
            }

            // onAdd
            if (!attrs[key].hasOwnProperty('onAdd')) {
                throw new Error('\'onAdd\' event required for discovery of an attribute');
            } else {
                if (typeof attrs[key].onAdd != 'string') {
                    throw new Error('the event name \'' + attrs[key].onAdd + '\' must be a string');
                }
            }

            // onRemove
            if (!attrs[key].hasOwnProperty('onRemove')) {
                throw new Error('\'onRemove\' event required for discovery of an attribute');
            } else {
                if (typeof attrs[key].onRemove != 'string') {
                    throw new Error('the event name \'' + attrs[key].onRemove + '\' must be a string');
                }
            }
        }
    }
}

Registrar.prototype._checkFormOfAttrsToAdd = function(attrs) {
    if (typeof attrs !== 'object') {
        throw new Error('attrs must be an object');
    }
    for (var i = 0; i < this.reservedAttrs.length; i++) {
        if (attrs[this.reservedAttrs[i]] !== undefined) {
            throw new Error('the attribute \'' + this.reservedAttrs[i] + '\' is reserved');
        }
    }
    for (var attr in attrs) {
        if (attrs[attr] === '') {
            throw new Error('the attribute ' + attr + ' has an empty string as its value - this is not permitted');
        }
    }
}

Registrar.prototype._reformatAttrsToRemove = function(attrs) {
    if (typeof attrs == 'string') {
        attrs = [attrs];
    } else if (!(attrs instanceof Array)) {
        throw new Error('attrs must be a string or an array of strings');
    }

    for (var i = 0; i < attrs.length; i++) {
        if (typeof attrs[i] != 'string') {
            throw new Error('attrs must be a string or an array of strings');
        } else if (attrs[i] == 'status') {
            throw new Error('the \'status\' attribute cannot be removed');
        }
    }

    return attrs;
}

/**
 * Upon receipt of a discovery event, pass it onto the rest of the application if it is not a duplicate
 */
Registrar.prototype._respondToDiscoveryEvent = function(self, attr, event, nodeId, value, dedupeId, protocol) {

    console.log("---------------------------------- ", event, nodeId, value);

    if (self.eliminateDuplicates && self._isDuplicate(self, attr, nodeId, dedupeId)) {
        return;
    }
    self._updateDiscoveries(self, attr, nodeId, dedupeId);

    // Because node offline events end up here instead of in _respondToAttrRemovalEvent, we need to check the attribute
    // and value in order to know what arguments to pass along with the event.
    if (attr === 'status' && value === 'offline') {
        self.emit(event, nodeId, protocol);
        return;
    }
    self.emit(event, nodeId, value, protocol);
}

/**
 * Returns true if a discovery is a duplicate and false otherwise.
 * attr - the attrubute for which a discovery was made
 * nodeId - the ID of the node for which the discovery was made
 * dedupeId - an ID that tells us if this message is a duplicate or not
 */
Registrar.prototype._isDuplicate = function(self, attr, nodeId, dedupeId) {
    if (!self.discoveries.hasOwnProperty(attr)) {
        return false;
    }

    if (!self.discoveries[attr].hasOwnProperty(nodeId)) {
        return false;
    }

    // Compare the dedupe ID of the last message with that of the current message
    // Because the dedupe IDs are timestamps, we say that a message is a duplicate
    // if its ID is less than or equal to the last received.
    if (dedupeId === 0 && self.discoveries[attr][nodeId] !== 0) {
        // The one exception is that a dedupeId of zero is used for node down events,
        // so we need to account for this special case.
        return false;
    }
    return dedupeId <= self.discoveries[attr][nodeId];
}

Registrar.prototype._updateDiscoveries = function(self, attr, nodeId, dedupeId) {
    if (!self.discoveries.hasOwnProperty(attr)) {
        self.discoveries[attr] = {};
    }
    self.discoveries[attr][nodeId] = dedupeId;
}

/* exports */
module.exports = Registrar;
