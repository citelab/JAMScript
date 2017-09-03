var EventEmitter = require('events'),
    globals = require('../constants').globals,
    constants = require('../constants'),
    MQTTRegistry = require('./mqttregistry'),
    MDNSRegistry = require('./mdnsregistry'),
    LocalRegistry = require('./localregistry'),
    os = require('os'),
    Registry = require('./registry');

//==============================================================================
// Helpers
//==============================================================================

/**
 * Returns true if two values are equivalent and false otherwise
 */
function equivalentValues(a, b) {
    // base cases
    if ((typeof a == 'number' && typeof b == 'number') ||
        (typeof a == 'string' && typeof b == 'string')) {
            return a == b;
    }

    if ((a == null && b == null) ||
        (a == undefined && b == undefined)) {
            return true;
    }

    if (a instanceof Array && b instanceof Array) {
        // recursive case 1
        return equivalentArrays(a, b);
    } else if (a instanceof Object && b instanceof Object) {
        // recursive case 2
        return equivalentObjects(a, b);
    }

    return false;
}

/**
 * Returns true if two arrays are equivalent or false otherwise
 * Note: Currently returns false for two arrays with the same elements but in a different order
 */
function equivalentArrays(a, b) {
    if (a.length != b.length) {
        return false;
    }

    for (var i = 0; i < a.length; i++) {
        if (!equivalentValues(a[i], b[i])) {
            return false;
        }
    }

    return true;
}

/**
 * Returns true if two objects are equivalent and false otherwise
 */
function equivalentObjects(a, b) {
    if (Object.keys(a).length != Object.keys(b).length) {
        return false;
    }

    for (var key in a) {
        if (!b.hasOwnProperty(key) || !equivalentValues(a[key], b[key])) {
            return false;
        }
    }

    return true;
}

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
// This Class is the interface between the application and the MQTT, mDNS, and
// local storage registries
//==============================================================================

function Registrar(app, machType, id, port, config) {
    // the name of the application
    this.app = app;
    // the type of this machine
    this.machType = machType;
    // the id of this machine
    this.id = id;
    // the port the program is running on
    this.port = port;

    // store discoveries so that we can easily check for duplicates
    this.discoveries = {};

    // reserved attributes
    this.reservedAttrs = ['status', 'lastCheckIn', 'createdAt', 'updatedAt'];

    this.started = false;

    //==========================================================================
    // config-specific set-up
    //==========================================================================

    var noProtocols = true;

    if (!config || config.mqtt) {
        var subQos = this.machType == globals.NodeType.DEVICE ? 0 : 1;
        var pubQos = this.machType == globals.NodeType.DEVICE ? 0 : 1;
        this.mqttRegistry = new MQTTRegistry(app, machType, id, port, subQos, pubQos);
        noProtocols = false;
    }

    if (!config || config.mdns) {
        this.mdnsRegistry = new MDNSRegistry(app, machType, id, port);
        noProtocols = false;
    }

    if (!config || config.localStorage) {
        this.localRegistry = new LocalRegistry(app, machType, id, port);
        noProtocols = false;
    }

    if (noProtocols) {
        throw new Error('a Registrar must use at least one protocol');
    }

    // set up default attributes, which are the same for devices, fogs, and clouds (i.e. just status)
    // default attributes:
    // status
    this.addAttributes({
        status: function() {
            return {
                port: port,
                ip: getIPv4Address()
            };
        }
    }, true);

    // prep the default discoveries to be made by a node:
    // devices discover fogs and fogs discover clouds
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
        // no default cloud discoveries!
    }

    // listen for events from the Registries
    var self = this;

    if (this.mqttRegistry) {
        this.mqttRegistry.on('sub-error', function(self, dattrs) {
            setTimeout(self.mqttRegistry.subscribe, constants.mqtt.longRetryInterval, self, dattrs);
        });

        this.mqttRegistry.on('subs-denied', function(self, dattrs) {
            var err = new Error('MQTT subscriptions denied');
            err.name = 'permissions_err';
            err.value = dattrs;
            self.emit('error', err);
        });

        this.mqttRegistry.on('unsub-error', function(self, dattrs) {
            setTimeout(self.mqttRegistry.unsubscribe, constants.mqtt.longRetryInterval, self, dattrs);
        });

        this.mqttRegistry.on('pub-error', function(self, attr, value) {
            setTimeout(self.mqttRegistry.publish, constants.mqtt.longRetryInterval, self, attr, value);
        });

        this.mqttRegistry.on('unpub-error', function(self, attr) {
            setTimeout(self.mqttRegistry.unpublish, constants.mqtt.longRetryInterval, self, attr);
        });

        this.mqttRegistry.on('discovery', function(attr, event, nodeId, value) {
            self._respondToDiscoveryEvent(self, attr, event, nodeId, value);
        });

        this.mqttRegistry.on('attr-removed', function(attr, event, nodeId) {
            self._respondToAttrRemovalEvent(self, attr, event, nodeId);
        });
    }

    if (this.mdnsRegistry) {
        this.mdnsRegistry.on('ad-error', function(self, attr, adName, txtRecord) {
            // an ad failed - try again after some time
            setTimeout(self.mdnsRegistry._createAdvertisementWithRetries, constants.mdns.longRetryInterval, self, attr, adName, txtRecord, 0);
        });

        this.mdnsRegistry.on('browser-error', function(self, attr, machType, events) {
            // a browser failed - try again after some time
            if (attr === 'status') {
                setTimeout(this.mdnsRegistry._browseForStatus, constants.mdns.longRetryInterval, self, machType, events);
            } else {
                setTimeout(this.mdnsRegistry._browse, constants.mdns.longRetryInterval, self, attr, machType, events);
            }
        });

        this.mdnsRegistry.on('discovery', function(attr, event, nodeId, value) {
            self._respondToDiscoveryEvent(self, attr, event, nodeId, value);
        });

        this.mdnsRegistry.on('attr-removed', function(attr, event, nodeId) {
            self._respondToAttrRemovalEvent(self, attr, event, nodeId);
        });
    }

    if (this.localRegistry) {
        this.localRegistry.on('discovery', function(attr, event, nodeId, value) {
            self._respondToDiscoveryEvent(self, attr, event, nodeId, value);
        });

        this.localRegistry.on('attr-removed', function(attr, event, nodeId) {
            self._respondToAttrRemovalEvent(self, attr, event, nodeId);
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
        if (this.localRegistry) {
            this.localRegistry.registerAndDiscover();
        }
        this.started = true;
    }
}

/**
 * Upon receipt of an attribute removal event, pass it onto the rest of the application if it
 * is something we don't already know
 */
Registrar.prototype._respondToAttrRemovalEvent = function(self, attr, event, nodeId) {
    if (self.discoveries.hasOwnProperty(attr) && self.discoveries[attr].hasOwnProperty(nodeId)) {
        delete self.discoveries[attr][nodeId];
        self.emit(event, nodeId);
    }
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
    // add the attributes on each protocol
    if (this.mqttRegistry) {
        this.mqttRegistry.addAttributes(attrs);
    }
    if (this.mdnsRegistry) {
        this.mdnsRegistry.addAttributes(attrs);
    }
    if (this.localRegistry) {
        this.localRegistry.addAttributes(attrs);
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
    if (this.localRegistry) {
        this.localRegistry.removeAttributes(attrs);
    }
}

/**
 * Specify attributes to be discovered
 attrs can have one of the following forms:
 (a)
    {
        all: {attr: event}, // discover these attributes for all nodes
        device: {attr: event}, // discover these attributes just for devices
        fog: {attr: event}, // discover these attributes just for fogs
        cloud: {attr: event} // discover these attributes just for clouds
    }
 (b) As a shortcut for all, one can simply pass an object of <attr, event> pairs
 */
Registrar.prototype.discoverAttributes = function(dattrs) {
    dattrs = this._checkAndReformatAttrsToDiscover(dattrs);
    if (this.mqttRegistry) {
        this.mqttRegistry.discoverAttributes(dattrs);
    }
    if (this.mdnsRegistry) {
        this.mdnsRegistry.discoverAttributes(dattrs);
    }
    if (this.localRegistry) {
        this.localRegistry.discoverAttributes(dattrs);
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
    if (this.localRegistry) {
        this.localRegistry.stopDiscoveringAttributes(dattrs);
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
        throw new Error('you must specity the attributes you want discovered as an object - see the docs');
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
        throw new Error('you must specity the attributes to stop discovering in an object or array - see the docs');
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
Registrar.prototype._respondToDiscoveryEvent = function(self, attr, event, nodeId, value) {
    if (!self._isDuplicate(self, attr, nodeId, value)) {
        self._updateDiscoveries(self, attr, nodeId, value);
        self.emit(event, nodeId, value);
    }
}

/**
 * Returns true if a discovery is a duplicate and false otherwise
 */
Registrar.prototype._isDuplicate = function(self, attr, nodeId, value) {
    if (!self.discoveries.hasOwnProperty(attr)) {
        return false;
    }

    if (!self.discoveries[attr].hasOwnProperty(nodeId)) {
        return false;
    }

    // compare the values
    return equivalentValues(value, self.discoveries[attr][nodeId]);
}

Registrar.prototype._updateDiscoveries = function(self, attr, nodeId, value) {
    if (!self.discoveries.hasOwnProperty(attr)) {
        self.discoveries[attr] = {};
    }
    self.discoveries[attr][nodeId] = value;
}

Registrar.prototype._retry = function(self, protocol) {
    if (protocol === globals.Protocol.MQTT) {
        console.log('retrying mqtt');
        self.mqttRegistry.registerAndDiscover();
    } else if (protocol === globals.Protocol.MDNS) {
        console.log('retrying mdns');
        self.mdnsRegistry.registerAndDiscover();
    }
}

Registrar.prototype.getUrl = function() {
    return 'tcp://' + getIPv4Address() + ':' + this.port;
}

/* exports */
module.exports = Registrar;
