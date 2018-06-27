const   EventEmitter = require('events'),
        globals = require('../jamserver/constants').globals,
        constants = require('../jamserver/constants'),
        MQTTRegistry = require('./mqttregistry'),
        MDNSRegistry = require('./mdnsregistry'),
        os = require('os');

/**
 * Registrar Class
 *      This class is the interface between the application
 *      and the MQTT, mDNS registries
 */

function RegistrarTail(app, type, id, port, config) {
    // the name of the application
    this.app = app;
    // the type of the machine the registar is running on (device, fog, or cloud)
    this.type = type;
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

    /**
     * DISCOVERY TABLE (dt)
     * Notes:
     *  --> We don't keep an entry for our own node
     *
     * And an example...
     * {
     *      node_id : {
     *          'attrs' : {
     *              'status' : {
     *                  'seqval' : seqval,
     *                  'data' : data
     *              },
     *              other_attr : {
     *                  'seqval' : seqval,
     *                  'data' : data
     *              }
     *          }
     *          'network' : 'LAN' || 'WAN',
     *          'other_useful_info' : ...
     *      },
     *      other_node_id : {
     *          ...
     *      }
     * }
     */
    this.dt = {};
    this.seqval = 0;

    /**
     * Reserved attributes.
     * These are attribute names that cannot be used by third parties.
     */
    this.reservedAttrs = ['status', 'lastCheckIn', 'createdAt', 'updatedAt'];

    /**
     * config-specific set-up
     */
    var noProtocols = true;

    this.mqttRegistry = null;
    if (!config || !config.protocols || config.protocols.mqtt) {
        // QoS |1| for MQTT: Message delivery is __AT_LEAST_ONCE__
        var subQos = 1,
            pubQos = 1;
        this.mqttRegistry = new MQTTRegistry(app, type, id, port, subQos, pubQos);
        noProtocols = false;
    }
    this.mdnsRegistry = null;
    if (!config || !config.protocols || config.protocols.mdns) {
        this.mdnsRegistry = new MDNSRegistry(app, type, id, port);
        noProtocols = false;
    }
    if (noProtocols) {
        throw new Error('a Registrar must use at least one protocol');
    }

    // whether or not this registrar has been started
    this.started = false;
}

/* Registrar inherits from EventEmitter */
RegistrarTail.prototype = Object.create(EventEmitter.prototype);
RegistrarTail.prototype.constructor = RegistrarTail;

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
RegistrarTail.prototype.registerAndDiscover = function(options) {

    if (this.started)
        return;

    /**
     * Set up default attributes, which are the same for devices, fogs, and clouds.
     * The only default attribute is 'status'.
     */
    this.setAttributes(
    {
        status: {
            port: this.port,
            ip: this._getIPv4Address()
        }
    });

    /**
     * Prep the default discoveries to be made by a node:
     * devices discover (fogs, clouds) and fogs discover clouds.
     */
    if (this.type === globals.NodeType.DEVICE) {
        // default discoveries:
        // devices discover fogs, clouds
        this.discoverAttributes({
            fog: {
                status: {
                    online: 'fog-up',
                    offline: 'fog-down'
                }
            },
            cloud: {
                status: {
                    online: 'cloud-up',
                    offline: 'cloud-down'
                }
            }
        });
    } else if (this.type === globals.NodeType.FOG) {
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

    /**
     * Set propagatable events
     */
    [this.mqttRegistry, this.mdnsRegistry].filter(x => x).map(x =>
    {
        let self = this;
        x.on('error', function(info) {
            self.emit('error', info);
        });
        x.on('discovery', function(attr, event, id, data, seqval) {
            self._respondToDiscoveryEvent.call(self, attr, event, id, data, seqval, x.protocol);
        });

        x.on('attr-removed', function(attr, event, id, seqval) {
            self._respondToRemovalEvent.call(self, attr, event, id, seqval, x.protocol);
        });
    });

    /**
     * Handle passed `options`
     * `options` include:
     *   attrsToSet: key/value pair as in this.setAttributes
     *   attrsToDiscover: as in this.discoverAttributes
     */
    if (options) {
        if (typeof options !== 'object') {
            throw new Error('options must be an object - see the docs');
        }

        if (options.attrsToSet) {
            this.setAttributes(options.attrsToAdd);
        }
        if (options.attrsToDiscover) {
            this.discoverAttributes(options.attrsToDiscover);
        }
    }

    [this.mqttRegistry, this.mdnsRegistry].map(
        x => {if(x) x.registerAndDiscover();}
    );
    this.started = true;
}

/**
 * Add custom, discoverable attributes to this node
 * attrs is an object of key value pairs
 */
RegistrarTail.prototype.setAttributes = function(attrs) {
    this._modifyAttributes("setAttributes", attrs, this._getSeqVal());
}
RegistrarTail.prototype.removeAttributes = function(attrs) {
    this._modifyAttributes("removeAttributes", attrs, this._getSeqVal());
}
RegistrarTail.prototype._modifyAttributes = function(fun, attrs, seqval) {
    if (attrs instanceof Array) {
        attrs = attrs.reduce((acc, p) => { acc[p] = null; return acc; }, {});
    }
    [this.mqttRegistry, this.mdnsRegistry].map(
        x => {if(x) x[fun](attrs, seqval);}
    );
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
RegistrarTail.prototype.discoverAttributes = function(dattrs) {
    dattrs = this._formatDattributes(dattrs);
    this._modifyDattributes("discoverAttributes", dattrs);
}
RegistrarTail.prototype.stopDiscoveringAttributes = function(dattrs) {
    dattrs = this._formatDattributes(dattrs);
    this._modifyDattributes("stopDiscoveringAttributes", dattrs);
}
/**
 * Marshall dattrs to the following format (expected by the registries)
 * { 'device' : {...}, 'fog' : {...}, 'cloud' : {...} }
 */
RegistrarTail.prototype._formatDattributes = function(dattrs) {
    // array mashalling
    if (dattrs instanceof Array) {
        dattrs = dattrs.reduce((acc, p) => { acc[p] = null; return acc; }, {});
    } else {
        ['device', 'fog', 'cloud'].filter(x => dattrs[x] instanceof Array).map(
            x => {
                dattrs[x] = dattrs[x].reduce((acc, p) => { acc[p] = null; return acc; }, {});
            }
        );
    }
    if (!(dattrs.all || dattrs.device || dattrs.fog || dattrs.cloud))
        dattrs = { 'all' : dattrs };
    ['device', 'fog', 'cloud'].map(
        x => {
            if(!dattrs[x]) dattrs[x] = {};
            // add all attrs in 'all' to each machine type
            if(dattrs.all)
                Object.assign(dattrs[x], dattrs.all);
        }
    )
    if(dattrs.all)
        delete dattrs.all;
    return dattrs;
}
RegistrarTail.prototype._modifyDattributes = function(fun, dattrs) {
    [this.mqttRegistry, this.mdnsRegistry].map(
        x => {if(x) x[fun](dattrs);}
    );
}
/**
 * Exit from network cleanly
 */
RegistrarTail.prototype.quit = function() {
    let seqval = this._getSeqVal();
    [this.mqttRegistry, this.mdnsRegistry].filter(x => x).map(
        (x) => {
            x.quit(seqval);
        }
    );
}

/**
 * _PRIVATE HELPERS
 */
/**
 * Upon receipt of a discovery event, pass it onto the rest of the application if it is not a duplicate
 */
RegistrarTail.prototype._respondToDiscoveryEvent = function(attr, event, id, data, seqval, protocol) {

    // DUBUGGING: Print shit
    console.log("DEBUG: Registrar._respondToDiscoveryEvent: ", event, id, data, seqval, protocol);

    // Update discovery table
    if (!this.dt.hasOwnProperty(id)) {
        this.dt[id] = {};
        this.dt[id]['attrs'] = {};
        // nodes are assumed to be on WAN by default
        this.dt[id]['network'] = 'WAN';
    }
    // maintain info about where the node is: 'LAN' or 'WAN'
    if (protocol === constants.globals.Protocol.MDNS) {
        this.dt[id]['network'] = 'LAN';
    }
    if (!this.dt[id]['attrs'].hasOwnProperty(attr))
        this.dt[id]['attrs'][attr] = {};

    // Because node offline events end up here instead of in _respondToRemovalEvent, we need to check the attribute
    // and value in order to know what arguments to pass along with the event.
    // WARNING: XXX __SEQVAL_BYPASS__ XXX
    // It should be noted that is a potential network race condition whereby it would be
    // possible to have status updates arriving to subscribers in the wrong order.
    // This could potentially be solved by subscribing to status topics with QoS 2
    // The above proposed solution is : NOT IMPLEMENTED due to how unlikely this is to happen.
    if (attr === 'status' && data === 'offline') {

        // ignore this if it has already been detected
        if(this.dt[id]['attrs']['status']['data'] == 'offline')
            return;

        // o.w.
        this.dt[id]['attrs']['status']['data'] = 'offline';
        // Set seqvals for all attributes of node to -1 in case the node crashed
        // ... this means any attr update  will be accepted when the node does so
        for(var key in this.dt[id]['attrs'])
            if(this.dt[id]['attrs'].hasOwnProperty(key))
                this.dt[id]['attrs'][key]['seqval'] = -1;
        this.emit('appNotifLess', event, id, protocol);
        return;
    }

    // Insert data/seqval pair if not already received
    if ( !this.dt[id]['attrs'][attr].hasOwnProperty('seqval')
       || this.dt[id]['attrs'][attr]['seqval'] < seqval
       || (  (this.dt[id]['attrs'][attr]['seqval'] > (Number.MAX_SAFE_INTEGER/2))
          && (seqval < (Number.MAX_SAFE_INTEGER/1024))))
    {
        this.dt[id]['attrs'][attr]['data'] = data;
        this.dt[id]['attrs'][attr]['seqval'] = seqval;

        this.emit('appNotifMore', event, id, data, protocol);
    } else {
        return;
    }
}

/**
 * Upon receipt of an attribute removal event, pass it onto the rest of the application
 */
RegistrarTail.prototype._respondToRemovalEvent = function(attr, event, id, seqval, protocol) {

    // DUBUGGING: Print shit
    console.log("DEBUG: Registar._respondToRemovalEvent: ", event, id, seqval, protocol);

    // check dt first
    if (  !this.dt.hasOwnProperty(id)
       || !this.dt[id]['attrs'].hasOwnProperty(attr))
        return;

    if ( !this.dt[id]['attrs'][attr].hasOwnProperty('seqval')
       || this.dt[id]['attrs'][attr]['seqval'] < seqval
       || (  (this.dt[id]['attrs'][attr]['seqval'] > (Number.MAX_SAFE_INTEGER/2))
          && (seqval < (Number.MAX_SAFE_INTEGER/1024))))
    {
        delete this.dt[id]['attrs'][attr];
        this.emit('appNotifLess', event, id, protocol);
    }
}

/**
 * returns next seq number for event ordering
 */
RegistrarTail.prototype._getSeqVal = function() {
    if (this.seqval == Number.MAX_SAFE_INTEGER) {
        this.seqval = 0;
    }
    return this.seqval++;
}

/**
 * returns the IPv4 address of the node
 */
RegistrarTail.prototype._getIPv4Address = function() {
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

/* exports */
module.exports = RegistrarTail;
