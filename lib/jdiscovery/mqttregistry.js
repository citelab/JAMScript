//==============================================================================
// Registers a node on the network using MQTT
//==============================================================================

var mqtt = require('mqtt'),
    logger = require('../jamserver/jerrlog.js'),
    constants = require('../jamserver/constants'),
    Registry = require('./registry');

function MQTTRegistry(app, machType, id, port, subQos, pubQos) {
    Registry.call(this, app, machType, id, port);
    // the quality of service to use for subscriptions
    this.subQos = subQos;
    // the quality of service to use for publications
    this.pubQos = pubQos;

    // attributes that have already been published
    this.publishedAttrs = {};
    // attributes that have already been subscribed to
    this.subscribedAttrs = {
        device: {},
        fog: {},
        cloud: {}
    };
    // attributes to be published on (re)connection
    this.attrsToPublish = {};
    // attributes to remove when reconnecting
    this.attrsToRemove = {};
    // attributes to subscribe to on (re)connection
    this.attrsToSubTo = {
        device: {},
        fog: {},
        cloud: {}
    };
    // attributes to unsubscribe from on reconnection
    this.attrsToUnsubFrom = {
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
MQTTRegistry.prototype.registerAndDiscover = function(options) {

    if (options) {
        if (options.attrsToAdd) {
            this.addAttributes(options.attrsToAdd);
        }
        if (options.attrsToDiscover) {
            this.discoverAttributes(options.attrsToDiscover);
        }
    }

    // create an mqtt client
    this.client = mqtt.connect(constants.mqtt.brokerUrl, this._getConnectionOptions());

    // set up event listeners for the client
    this._prepareForEvents();
}

/**
 * A general helper for listening for events from the MQTT client
 */
MQTTRegistry.prototype._prepareForEvents = function() {
    var self = this;

    /* connect event emitted on successful connection or reconnection */
    this.client.on('connect', function (connack) {
        if (!connack.sessionPresent) {
            /*
             * session is not present - subscriptions start from scratch but
             * old publications could still be persisted on the broker
             */
            // reset attrsToUnsubFrom
            self.attrsToUnsubFrom = {
                device: {},
                fog: {},
                cloud: {}
            };
            // subscribe
            // combine subscribedAttrs and attrsToSubTo so that we can subscribe to all of them
            for (var attr in self.subscribedAttrs.device) {
                self.attrsToSubTo.device[attr] = self.subscribedAttrs.device[attr];
            }
            for (var attr in self.subscribedAttrs.fog) {
                self.attrsToSubTo.fog[attr] = self.subscribedAttrs.fog[attr];
            }
            for (var attr in self.subscribedAttrs.cloud) {
                self.attrsToSubTo.cloud[attr] = self.subscribedAttrs.cloud[attr];
            }
            self.subscribedAttrs = {
                device: {},
                fog: {},
                cloud: {}
            };
            self._subscribeWithRetries(self, self.attrsToSubTo, constants.mqtt.retries);
            // publish
            for (var attr in self.publishedAttrs) {
                self.attrsToPublish[attr] = self.publishedAttrs[attr];
            }
            self.publishedAttrs = {};
            for (var attr in self.attrsToPublish) {
                self._publishWithRetries(self, attr, self.attrsToPublish[attr], constants.mqtt.retries);
            }
            // unpublish
            for (var attr in self.attrsToRemove) {
                self._unpublishWithRetries(self, attr, constants.mqtt.retries);
            }
        } else {
            /*
             * session is present - old subscriptions are still there so we only need to subscribe to new ones
             * but we also need to unsubscribe from attrsToUnsubFrom
             * we make no assumptions about the state of publications
             */
            // subscribe
            self._subscribeWithRetries(self, self.attrsToSubTo, constants.mqtt.retries);
            // unsubscribe
            self._unsubscribeWithRetries(self, self.attrsToRemove, constants.mqtt.retries);
            // publish
            for (var attr in self.publishedAttrs) {
                self.attrsToPublish[attr] = self.publishedAttrs[attr];
            }
            self.publishedAttrs = {};
            for (var attr in self.attrsToPublish) {
                self._publishWithRetries(self, attr, self.attrsToPublish[attr], constants.mqtt.retries);
            }
            // unpublish
            for (var attr in self.attrsToRemove) {
                self._unpublishWithRetries(self, attr, constants.mqtt.retries);
            }
        }
    });

    /* message event received when client receives a published packet */
    this.client.on('message', function (topic, message, packet) {
        // if the message is an empty string, then this is the result of an
        // "unpublish" and should be ignored
        if (message.toString() !== '') {
            self._handleMessage(self, topic, JSON.parse(message.toString()).payload);
        }
    });

    /*
    this.client.on('reconnect', function () {
        console.log('client reconnected')
    });

    this.client.on('close', function () {
        console.log('client disconnected')
    });
    */

    this.client.on('offline', function () {
        //self.emit('error');
    });

    this.client.on('error', function (error) {
        //self.emit('error');
    });
}

/**
 * Handles receipt of a message from the MQTT broker. Finds the subscription that
 * the message corresponds to and executes the appropriate action.
 */
MQTTRegistry.prototype._handleMessage = function(self, topic, message) {
    // parse the mach type, the mach id, and the attribute out of the topic
    
    var components = topic.split('/');
    var machType = components[1];
    var machId = components[2];
    var attr = components[3];

    var eventName;
    if (self.subscribedAttrs[machType].hasOwnProperty(attr)) {
        if (attr === 'status') {
            if (message === 'offline') {
                eventName = self.subscribedAttrs[machType].status.offline;
            } else {
                eventName = self.subscribedAttrs[machType].status.online;
            }
        } else {
            eventName = self.subscribedAttrs[machType][attr];
        }
    }

    if (eventName !== undefined) {
        self.emit('discovery', attr, eventName, machId, message);
    } else {
        console.log('event name is undefined - this may be because we are still awaiting a subscription confirmation for this message');
    }
}

/**
 * Helper for setting up subscriptions to the broker with retries
 */
MQTTRegistry.prototype._subscribeWithRetries = function(self, dattrs, retries) {
    var subs = {};

    for (var attr in dattrs.device) {
        subs[self.app + '/device/+/' + attr] = self.subQos;
    }

    for (var attr in dattrs.fog) {
        subs[self.app + '/fog/+/' + attr] = self.subQos;
    }

    for (var attr in dattrs.cloud) {
        subs[self.app + '/cloud/+/' + attr] = self.subQos;
    }

    if (Object.keys(subs).length === 0) {
        return;
    }

    self.client.subscribe(subs, function (err, granted) {
        if (err) {
            if (retries !== 0) {
                setTimeout(self._subscribeWithRetries, constants.mqtt.retryInterval, self, dattrs, retries - 1);
            } else {
                self.emit('sub-error', self, dattrs);
            }
        } else {
            // move attrs from attrsToSubTo to subscribedAttrs
            var components, machType, attr;
            for (var i = 0; i < granted.length; i++) {
                components = granted[i].topic.split('/');
                machType = components[1];
                attr = components[3];
                self.subscribedAttrs[machType][attr] = dattrs[machType][attr];
                delete self.attrsToSubTo[machType][attr];
                delete dattrs[machType][attr];
            }

            // report any subscriptions that weren't granted
            if (Object.keys(dattrs.device).length !== 0 ||
                Object.keys(dattrs.fog).length !== 0 ||
                Object.keys(dattrs.cloud).length !== 0) {
                    self.emit('subs-denied', dattrs);
            }
        }
    });
}

MQTTRegistry.prototype.subscribe = function(self, dattrs) {
    if (self.client && self.client.connected) {
        self._subscribeWithRetries(self, dattrs, constants.mqtt.retries);
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
                self.emit('unsub-error', self, dattrs);
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
    // if we're disconnected, then we'll automatically try to unsubscribe from the attributes when we connect
}

/**
 * Helper for publishing an attribute with retries
 */
MQTTRegistry.prototype._publishWithRetries = function(self, attr, value, retries) {
    var msg;
    if (value instanceof Function) {
        msg = JSON.stringify({ payload: value() });
    } else {
        msg = JSON.stringify({ payload: value });
    }
    self.client.publish(self.app + '/' + self.machType + '/' + self.id + '/' + attr, msg, {qos: self.pubQos, retain: true}, function (err) {
        if (err) {
            if (retries === 0) {
                setTimeout(self._publishWithRetries, constants.mqtt.retryInterval, self, attr, value, retries - 1);
            } else {
                self.emit('pub-error', self, attr, value);
            }
        } else {
            // move the attribute from attrsToPublish to publishedAttrs
            self.publishedAttrs[attr] = value;
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
    self.client.publish(self.app + '/' + self.machType + '/' + self.id + '/' + attr, null, {qos: self.pubQos, retain: true}, function (err) {
        if (err) {
            if (retries > 0) {
                setTimeout(self._unpublishWithRetries, constants.mqtt.retryInterval, self, attr, retries - 1);
            } else {
                self.emit('unpub-error', self, attr);
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

/**
 * Returns connection options to the mqtt broker contingent upon the connecting node
 * takes as arguments the name of the application, the type of the machine, and the
 * id of the machine
 */
MQTTRegistry.prototype._getConnectionOptions = function() {
    // create the will
    var will = {
        topic: this.app + '/' + this.machType + '/' + this.id + '/status',
        payload: JSON.stringify({ payload: 'offline' }),
        qos: this.pubQos,
        retain: true
    }

    // set and return the connection options
    return {
        clientId: this.id,
        keepalive: constants.mqtt.keepAlive,
        clean: false,
        connectTimeout: constants.mqtt.connectionTimeout,
        will: will
    };
}

//==============================================================================
// Custom attribute publication/discovery
//==============================================================================

/**
 * Add and publish discoverable attributes for this node
 */
MQTTRegistry.prototype.addAttributes = function(attrs) {
    for (var attr in attrs) {
        // just in case this is in the queue for removal...
        delete this.attrsToRemove[attr];
        // check that it's not already published
        if (!this.publishedAttrs.hasOwnProperty(attr)) {
            this.attrsToPublish[attr] = attrs[attr];
            if (this.client && this.client.connected) {
                // try to publish the attribute
                this._publishWithRetries(this, attr, attrs[attr], constants.mqtt.retries);
            }
        }
    }
}

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
        this._subscribeWithRetries(this, subs, constants.mqtt.retries);
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
 * Closes the client, executing the callback upon completion
 */
/*
MQTTRegistry.prototype.quit = function(cb) {
    if (this.client) {
        this.client.end(false, cb);
    }
}
*/

/* exports */
module.exports = MQTTRegistry;
