//==============================================================================
// Registers a node on the network using MQTT
//==============================================================================

var mqtt = require('mqtt'),
    logger = require('../jamserver/jerrlog.js'),
    constants = require('../jamserver/constants'),
    Registry = require('./registry');

function MQTTRegistry(app, type, id, port, subQos, pubQos) {
    Registry.call(this, app, type, id, port);
    this.protocol = constants.globals.Protocol.MQTT; 
    // the quality of service to use for subscriptions
    this.subQos = subQos;
    // the quality of service to use for publications
    this.pubQos = pubQos;

    /**
     * Attributes currently published. A map from attribute name
     * to { payload: attribute_value, dedupeId: deduplication_id } objects.
     */
    this.publishedAttrs = {};
    // attributes that have already been subscribed to
    this.subscribedAttrs = {
        device: {},
        fog: {},
        cloud: {}
    };
}

/* MQTTRegistry inherits from Registry */
MQTTRegistry.prototype = Object.create(Registry.prototype);
MQTTRegistry.prototype.constructor = MQTTRegistry;

/**
 * Performs basic registration and discovery
 */
MQTTRegistry.prototype.registerAndDiscover = function() {
    // create an mqtt client
    this.client = mqtt.connect(constants.mqtt.brokerUrl, this._getConnectionOptions());

    // set up event listeners for the client
    this._prepareForEvents();
}

/**
 * Returns connection options to the mqtt broker contingent upon the connecting node
 * takes as arguments the name of the application, the type of the machine, and the
 * id of the machine
 * CleanSession: true
 * Last Will (LWT): (retain: true)
 */
MQTTRegistry.prototype._getConnectionOptions = function() {

    // create the will
    var will = {
        topic: this.app + '/' + this.type + '/' + this.id + '/status',
        payload: JSON.stringify({ payload: 'offline' }),
        qos: this.pubQos,
        retain: true
    }

    // set and return the connection options
    return {
        clientId: this.id,
        keepalive: constants.mqtt.keepAlive,
        clean: true,
        connectTimeout: constants.mqtt.connectionTimeout,
        will: will
    };
}

/**
 * A general helper for listening for events from the MQTT client
 */
MQTTRegistry.prototype._prepareForEvents = function() {
    var self = this;

    /* connect event emitted on successful connection or reconnection */
    this.client.on('connect', function (connack) {

		/*
		 * session is not present - subscriptions start from scratch
		 * publications persist across connections on the broker (retain flag)
		 */

        /*...SUBSCRIBE...*/
		self._subscribeWithRetries.call(self, JSON.parse(JSON.stringify(self.attrsToSubTo)), constants.mqtt.retries);

        /* XXX We aren't actually republishing anything ;) 
        ...PUBLISH...
        for (var attr in self.attrsToPublish) {
            self._publishWithRetries(self, attr, self.attrsToPublish[attr].payload, self.attrsToPublish[attr].dedupeId, constants.mqtt.retries);
        }
        ...UNPUBLISH...
        for (var attr in self.attrsToRemove) {
            self._unpublishWithRetries(self, attr, constants.mqtt.retries);
        }
        */
    });

    /* message event received when client receives a published packet */
    this.client.on('message', function (topic, message, packet) {
        // parse the mach type, the mach id, and the attribute out of the topic
        var components = topic.split('/');
        var type = components[1];
        var id = components[2];
        var attr = components[3];

        // if the message payload is empty, this is the result of an "unpublish".
        const parsed = JSON.parse(message.toString());
        self._handleMessage.call(self, type, id, attr, parsed.payload, parsed.id);
    });

    this.client.on('offline', function () {
        console.log('WARNING: mqtt client is offline');
    });

    this.client.on('error', function (error) {
        console.log('WARNING: mqtt client received an error');
    });
}

/*
        this.mqttRegistry.on('sub-error', function(attrs) {
            setTimeout(self.mqttRegistry.subscribe, constants.mqtt.longRetryInterval, self.mqttRegistry, attrs);
        });

        this.mqttRegistry.on('subs-denied', function(attrs) {
            var err = new Error('MQTT subscriptions denied');
            err.name = 'permissions_err';
            err.value = attrs;
            self.emit('error', err);
        });

        this.mqttRegistry.on('unsub-error', function(attrs) {
            setTimeout(self.mqttRegistry.unsubscribe, constants.mqtt.longRetryInterval, self.mqttRegistry, attrs);
        });

        this.mqttRegistry.on('pub-error', function(attr, value) {
            setTimeout(self.mqttRegistry.publish, constants.mqtt.longRetryInterval, self.mqttRegistry, attr, value);
        });

        this.mqttRegistry.on('unpub-error', function(attr) {
            setTimeout(self.mqttRegistry.unpublish, constants.mqtt.longRetryInterval, self.mqttRegistry, attr);
        });
*/

/**
 * Handles receipt of a message from the MQTT broker. Finds the subscription that
 * the message corresponds to and executes the appropriate action.
 */
MQTTRegistry.prototype._handleMessage = function(type, id, attr, data, seqval) {

    var event;

    // payload empty <=> unpublish on attr
    if (data === '') 
    {
        if (this.subscribedAttrs[type].hasOwnProperty(attr)) {
            event = this.subscribedAttrs[type][attr].onRemove;
        }
        if (event !== undefined)
            this.emit('attr-removed', attr, event, id, seqval);
    } 
    else if (this.subscribedAttrs[type].hasOwnProperty(attr)) 
    {
        if (attr === 'status') {
            if (payload === 'offline') {
                event = this.subscribedAttrs[type].status.offline;
            } else {
                event = this.subscribedAttrs[type].status.online;
            }
        } else {
            event = this.subscribedAttrs[type][attr].onAdd;
        }
        if (event !== undefined)
            this.emit('discovery', attr, event, id, data, seqval);
    }
}

/**
 * Helper for setting up subscriptions to the broker with retries
 */
MQTTRegistry.prototype._subscribeWithRetries = function(dattrs, retries) {
    // format subscriptions to be sent to the broker
    var subs = {};

    for (var attr in dattrs.device) {
        subs[this.app + '/device/+/' + attr] = this.subQos;
    }

    for (var attr in dattrs.fog) {
        subs[this.app + '/fog/+/' + attr] = this.subQos;
    }

    for (var attr in dattrs.cloud) {
        subs[this.app + '/cloud/+/' + attr] = this.subQos;
    }

    if (Object.keys(subs).length === 0) {
        return;
    }

    // optimistically move these subscriptions from attrsToSubTo to subscribedAttrs
    for (var attr in dattrs.device) {
        delete this.attrsToSubTo.device[attr];
        this.subscribedAttrs.device[attr] = dattrs.device[attr];
    }

    for (var attr in dattrs.fog) {
        delete this.attrsToSubTo.fog[attr];
        this.subscribedAttrs.fog[attr] = dattrs.fog[attr];
    }

    for (var attr in dattrs.cloud) {
        delete this.attrsToSubTo.cloud[attr];
        this.subscribedAttrs.cloud[attr] = dattrs.cloud[attr];
    }

    // perform subscriptions
    this.client.subscribe(subs, function (err, granted) {
        if (err) {
            if (retries !== 0) {
                setTimeout(this._subscribeWithRetries.bind(this), 
                    constants.mqtt.retryInterval, this, dattrs, retries - 1);
            } else {
                // move all attributes back to attrsToSubTo and emit an error
                for (var attr in dattrs.device) {
                    delete this.subscribedAttrs.device[attr];
                    this.attrsToSubTo.device[attr] = dattrs.device[attr];
                }

                for (var attr in dattrs.fog) {
                    delete this.subscribedAttrs.fog[attr];
                    this.attrsToSubTo.fog[attr] = dattrs.fog[attr];
                }

                for (var attr in dattrs.cloud) {
                    delete this.subscribedAttrs.cloud[attr];
                    this.attrsToSubTo.cloud[attr] = dattrs.cloud[attr];
                }
                this.emit('sub-error', dattrs);
            }
        } else {
            // move any attrs that were denied from subscribedAttrs to attrsToSubTo and
            // emit an event indicating the attributes that were denied
            var components, type, attr;
            for (var i = 0; i < granted.length; i++) {
                components = granted[i].topic.split('/');
                type = components[1];
                attr = components[3];
                delete dattrs[type][attr];
            }

            for (var attr in dattrs.device) {
                delete this.subscribedAttrs.device[attr];
                this.attrsToSubTo.device[attr] = dattrs.device[attr];
            }

            for (var attr in dattrs.fog) {
                delete this.subscribedAttrs.fog[attr];
                this.attrsToSubTo.fog[attr] = dattrs.fog[attr];
            }

            for (var attr in dattrs.cloud) {
                delete this.subscribedAttrs.cloud[attr];
                this.attrsToSubTo.cloud[attr] = dattrs.cloud[attr];
            }

            // report any subscriptions that weren't granted
            if (Object.keys(dattrs.device).length !== 0 ||
                Object.keys(dattrs.fog).length !== 0 ||
                Object.keys(dattrs.cloud).length !== 0) {
                    this.emit('subs-denied', dattrs);
            }
        }
    });
}

MQTTRegistry.prototype.subscribe = function(dattrs) {
    if (this.client && this.client.connected) {
        this._subscribeWithRetries.call(this, dattrs, constants.mqtt.retries);
    }
    // if we're disconnected, then we'll automatically try to subscribe to the attributes when we connect
}

/**
 * Unsubscribe from a series of topics
 */
MQTTRegistry.prototype._unsubscribeWithRetries = function(self, dattrs, retries) {
    var topics = [];
    for (var attr in dattrs.device) {
        topics.push(self.app + '/device/+/' + dattrs.device[attr]);
    }

    for (var attr in dattrs.fog) {
        topics.push(self.app + '/fog/+/' + dattrs.fog[attr]);
    }

    for (var attr in dattrs.cloud) {
        topics.push(self.app + '/cloud/+/' + dattrs.cloud[attr]);
    }

    if (topics.length === 0) {
        return;
    }

    self.client.unsubscribe(topics, function(err) {
        if (err) {
            if (retries > 0) {
                setTimeout(self._unsubscribeWithRetries, constants.mqtt.retryInterval, self, topics, retries - 1);
            } else {
                self.emit('unsub-error', dattrs);
            }
        } else {
            for (var attr in dattrs.device) {
                delete self.subscribedAttrs.device[attr];
                delete self.attrsToUnsubFrom.device[attr];
            }
            for (var attr in dattrs.fog) {
                delete self.subscribedAttrs.fog[attr];
                delete self.attrsToUnsubFrom.fog[attr];
            }
            for (var attr in dattrs.cloud) {
                delete self.subscribedAttrs.cloud[attr];
                delete self.attrsToUnsubFrom.cloud[attr];
            }
        }
    });
}

MQTTRegistry.prototype.unsubscribe = function(self, dattrs) {
    if (self.client && self.client.connected) {
        self._unsubscribeWithRetries(self, dattrs, constants.mqtt.retries);
    }
    // if we're disconnected, then we have already been unsubscribed (cleanSession: true)
}

/**
 * Helper for publishing an attribute with retries.
 * attr - the name of the attribute
 * value - the value of the attribute
 * dedupeId - the ID to publish with the attributes for deduplication purposes on
 *  on the receiving node
 * retries - the number of retries, if publishing fails
 */
MQTTRegistry.prototype._publishWithRetries = function(self, attr, value, dedupeId, retries) {
    var msg;
    if (value instanceof Function) {
        msg = JSON.stringify({ payload: value(), id: dedupeId });
    } else {
        msg = JSON.stringify({ payload: value, id: dedupeId });
    }
    self.client.publish(self.app + '/' + self.type + '/' + self.id + '/' + attr, msg, {qos: self.pubQos, retain: true}, function (err) {
        if (err) {
            if (retries === 0) {
                setTimeout(self._publishWithRetries, constants.mqtt.retryInterval, self, attr, value, dedupeId, retries - 1);
            } else {
                self.emit('pub-error', attr, value);
            }
        } else {
            // move the attribute from attrsToPublish to publishedAttrs
            self.publishedAttrs[attr] = { payload: value, dedupeId: dedupeId };
            delete self.attrsToPublish[attr];
        }
    });
}

MQTTRegistry.prototype.publish = function(self, attr, value) {
    if (self.client && self.client.connected) {
        self._publishWithRetries(self, attr, value, constants.mqtt.retries);
    }
    // if we're disconnected, then we'll automatically try to publish the attributes when we connect
}

/**
 * Helper for "un"-publishing an attribute
 */
MQTTRegistry.prototype._unpublishWithRetries = function(self, attr, retries) {
    self.client.publish(self.app + '/' + self.type + '/' + self.id + '/' + attr, null, {qos: self.pubQos, retain: true}, function (err) {
        if (err) {
            if (retries > 0) {
                setTimeout(self._unpublishWithRetries, constants.mqtt.retryInterval, self, attr, retries - 1);
            } else {
                self.emit('unpub-error', attr);
            }
        } else {
            // remove the attribute from attrsToRemove and publishedAttrs
            delete self.attrsToRemove[attr];
            delete self.publishedAttrs[attr];
        }
    });
}

MQTTRegistry.prototype.unpublish = function(self, attr) {
    if (self.client && self.client.connected) {
        self._unpublishWithRetries(self, attr, constants.mqtt.retries);
    }
    // if we're disconnected, then we'll automatically try to publish the attributes when we connect
}

//==============================================================================
// Custom attribute publication/discovery
//==============================================================================

/**
 * Add and publish attributes for this node
 */
MQTTRegistry.prototype.addAttributes = function(attrs, dedupeId) {
    for (var attr in attrs) {
        // just in case this is in the queue for removal...
        delete this.attrsToRemove[attr];
        // check that it's not already published
        if (!this.publishedAttrs.hasOwnProperty(attr)) {
            this.attrsToPublish[attr] = { payload: attrs[attr], dedupeId: dedupeId };
            if (this.client && this.client.connected) {
                // try to publish the attribute
                this._publishWithRetries(this, attr, attrs[attr], dedupeId, constants.mqtt.retries);
            }
        }
    }
}

/**
 * Unpublishes the given attributes.
 * attrs - an array of the names (strings) of the attributes to remove.
 */
MQTTRegistry.prototype.removeAttributes = function(attrs) {
    for (var i = 0; i < attrs.length; i++) {
        // remove it from attrsToPublish, if need be
        delete this.attrsToPublish[attrs[i]];
        if (this.publishedAttrs.hasOwnProperty(attrs[i])) {
            this.attrsToRemove[attrs[i]] = null;
            if (this.client && this.client.connected) {
                // try to remove it
                this._unpublishWithRetries(this, attrs[i], constants.mqtt.retries);
            }
        }
    }
}

MQTTRegistry.prototype.discoverAttributes = function(dattrs) {
    var subs = null;

    for (var attr in dattrs.device) {
        // in case this attr is queued up to be unsubscribed from
        delete this.attrsToUnsubFrom.device[attr];
        if (!this.subscribedAttrs.device.hasOwnProperty(attr)) {
            // try to subscribe to it
            if (subs === null) {
                subs = {
                    device: {},
                    fog: {},
                    cloud: {}
                };
            }
            subs.device[attr] = dattrs.device[attr];
            this.attrsToSubTo.device[attr] = dattrs.device[attr];
        }
    }

    for (var attr in dattrs.fog) {
        // in case this attr is queued up to be unsubscribed from
        delete this.attrsToUnsubFrom.fog[attr];
        if (!this.subscribedAttrs.fog.hasOwnProperty(attr)) {
            // try to subscribe to it
            if (subs === null) {
                subs = {
                    device: {},
                    fog: {},
                    cloud: {}
                };
            }
            subs.fog[attr] = dattrs.fog[attr];
            this.attrsToSubTo.fog[attr] = dattrs.fog[attr];
        }
    }

    for (var attr in dattrs.cloud) {
        // in case this attr is queued up to be unsubscribed from
        delete this.attrsToUnsubFrom.cloud[attr];
        if (!this.subscribedAttrs.cloud.hasOwnProperty(attr)) {
            // try to subscribe to it
            if (subs === null) {
                subs = {
                    device: {},
                    fog: {},
                    cloud: {}
                };
            }
            subs.cloud[attr] = dattrs.cloud[attr];
            this.attrsToSubTo.cloud[attr] = dattrs.cloud[attr];
        }
    }

    if (subs !== null && this.client && this.client.connected) {
        this._subscribeWithRetries.call(this, subs, constants.mqtt.retries);
    }
}

MQTTRegistry.prototype.stopDiscoveringAttributes = function(dattrs) {
    var unsubs = null;

    if (dattrs.device) {
        for (var i = 0; i < dattrs.device.length; i++) {
            delete this.attrsToSubTo.device[dattrs.device[i]];
            if (this.subscribedAttrs.hasOwnProperty(dattrs.device[i])) {
                this.attrsToUnsubFrom.device[dattrs.device[i]] = null;
                if (unsubs === null) {
                    unsubs = {
                        device: {},
                        fog: {},
                        cloud: {}
                    }
                }
                unsubs.device[dattrs.device[i]] = null;
            }
        }
    }

    if (dattrs.fog) {
        for (var i = 0; i < dattrs.fog.length; i++) {
            delete this.attrsToSubTo.fog[dattrs.fog[i]];
            if (this.subscribedAttrs.hasOwnProperty(dattrs.fog[i])) {
                this.attrsToUnsubFrom.fog[dattrs.fog[i]] = null;
                if (unsubs === null) {
                    unsubs = {
                        device: {},
                        fog: {},
                        cloud: {}
                    }
                }
                unsubs.fog[dattrs.fog[i]] = null;
            }
        }
    }

    if (dattrs.cloud) {
        for (var i = 0; i < dattrs.cloud.length; i++) {
            delete this.attrsToSubTo.cloud[dattrs.cloud[i]];
            if (this.subscribedAttrs.hasOwnProperty(dattrs.cloud[i])) {
                this.attrsToUnsubFrom.cloud[dattrs.cloud[i]] = null;
                if (unsubs === null) {
                    unsubs = {
                        device: {},
                        fog: {},
                        cloud: {}
                    }
                }
                unsubs.cloud[dattrs.cloud[i]] = null;
            }
        }
    }

    if (unsubs !== null && this.client && this.client.connected) {
        this._unsubscribeWithRetries(this, unsubs, constants.mqtt.retries);
    }
}

/**
 * Closes the mqtt registry
 * --> Cleans up all publications on mqtt broker
 * --> Kills connection to broker
 */
MQTTRegistry.prototype.quit = function() {

    if (this.client) {
        // unpublish on all attributes
        this.removeAttributes(this.publishedAttrs);
        // unpublish status
        this.client.publish(this.app + '/' + this.type + '/' + this.id + '/status',
                            null, {qos: this.pubQos, retain: true});
        // end connection
        this.client.end(false);
    }
    this.client = null;
}

/* exports */
module.exports = MQTTRegistry;
