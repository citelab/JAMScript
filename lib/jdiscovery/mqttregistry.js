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
 * Handles receipt of a message from the MQTT broker. Finds the subscription that
 * the message corresponds to and executes the appropriate action.
 */
MQTTRegistry.prototype._handleMessage = function(type, id, attr, data, seqval) {

    var event;

    // data empty <=> unpublish on attr
    if (data === undefined) 
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
            if (data === 'offline') {
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

    // create topic strings to be sent to the broker for subscription
    var topics = [];
    ['device', 'fog', 'cloud'].map(x =>
    {
        for (var attr in dattrs[x]) {
            topics.push(this.app + '/' + x + '/+/' + attr);
        }
    }
    if (topics.length === 0)
        return;

    // add new subscriptions to subscribedAttrs
    ['device', 'fog', 'cloud'].map(x =>
    {
        for (var attr in dattrs[x]) {
            this.subscribedAttrs[x][attr] = dattrs[x][attr];
        }
    });

    // perform subscriptions
    var self = this;
    this.client.subscribe(
        topics, 
        { qos : this.subQos }, 
        function (err, granted) {
            if (err) {
                // Let -1 signify infinite retries
                if (retries > 0 || retries == -1) {
                    setTimeout(self._subscribeWithRetries.bind(self),
                        constants.mqtt.retryInterval, dattrs,
                        (retries === -1) ? -1 : (retries-1));
                } else {
                    granted.map(x =>
                    {
                        let topic = x.topic.split('/');
                        let type = topic[1];
                        let attr = topic[3];
                        delete dattrs[type][attr]
                    }
                    ['device', 'fog', 'cloud'].map(x =>
                    {
                        for (var attr in dattrs[x])
                            delete self.subscribedAttrs[x][attr];
                    }
                    // notify user something fishy is going on, probably an attr name error..
                    console.log('WARNING: MQTT Registry failed to subscribe to some topics');
                }
            }
    });
}
/**
 * Unsubscribe from a series of topics
 */
MQTTRegistry.prototype._unsubscribeWithRetries = function(dattrs, retries) {

    var topics = [];
    ['device', 'fog', 'cloud'].map(x =>
    {
        for (var attr in dattrs[x]) {
            topics.push(this.app + '/' + x + '/+/' + attr);
        }
    }
    if (topics.length === 0)
        return;

    var self = this;
    this.client.unsubscribe(
        topics, 
        function(err) {
            if (err) {
                // Let -1 signify infinite retries
                if (retries > 0 || retries == -1)
                    setTimeout(self._unsubscribeWithRetries.bind(self),
                        constants.mqtt.retryInterval, dattrs,
                        (retries === -1) ? -1 : (retries-1));
            } else {
                ['device', 'fog', 'cloud'].map(x =>
                {
                    for (var attr in dattrs[x])
                        delete self.subscribedAttrs[x][attr];
                }
            }
    });
}
MQTTRegistry.prototype._publishWithRetries = function(attr, data, seqval, retries) {

    /** 
     * When data === undefined, the receivers will interpret this as an attr removal
     * Data is set to _null_ on publishing attrs with no data to avoid this
     */
    if(data === undefined)
        data = null;

    var self = this;
    this.client.publish(
        (this.app + '/' + this.type + '/' + this.id + '/' + attr),
        (data instanceof Function)
            ? JSON.stringify({ data: data(), seqval: seqval })
            : JSON.stringify({ data: data, seqval: seqval }),
        {qos: this.pubQos, retain: true},
        function (err) {
            if (err) {
                if (retries > 0 || retries === -1)
                    setTimeout(self._publishWithRetries.bind(self), 
                        constants.mqtt.retryInterval, attr, data, seqval,
                        (retries === -1) ? -1 : (retries-1));
            } else {
                self.publishedAttrs[attr] = { data : data , seqval : seqval };
            }
    });
}
MQTTRegistry.prototype._unpublishWithRetries = function(attr, seqval, retries) {

    var self = this;
    this.client.publish(
        (this.app + '/' + this.type + '/' + this.id + '/' + attr),
        // n.b. 'data' property must be __undefined__
        JSON.stringify({ seqval : seqval }), 
        {qos: this.pubQos, retain: true}, 
        function (err) {
            if (err) {
                if (retries > 0 || retries === -1)
                    setTimeout(self._unpublishWithRetries.bind(self), 
                        constants.mqtt.retryInterval, attr, seqval, 
                        (retries === -1) ? -1 : (retries-1));
            } else {
                delete self.publishedAttrs[attr];
            }
    });
}
MQTTRegistry.prototype._publish = function(attr, data, seqval) {
    if (this.client && this.client.connected) {
        this._publishWithRetries(attr, data, seqval, constants.mqtt.retries);
    } else {
        var self = this;
        setTimeout(self._publish.bind(self), 
            constants.mqtt.retryInterval, attr, data, seqval);
    }
}
MQTTRegistry.prototype._unpublish = function(attr, seqval) {
    if (this.client && this.client.connected) {
        this._unpublishWithRetries(attr, seqval, constants.mqtt.retries);
    } else {
        var self = this;
        setTimeout(self._unpublish.bind(self), 
            constants.mqtt.retryInterval, attr, seqval);
    }
}

/**
 * REGISTRY INTERFACE METHODS
 */
/**
 * Performs basic registration and discovery
 */
MQTTRegistry.prototype.registerAndDiscover = function() {
    // create an mqtt client
    this.client = mqtt.connect(constants.mqtt.brokerUrl, this._getConnectionOptions());

    var self = this;

    /* connect event emitted on successful connection or reconnection */
    this.client.on('connect', function (connack) {
		/*
		 * session is not present - subscriptions start from scratch
		 * publications persist across connections on the broker (retain flag)
		 */
		self._subscribeWithRetries.call(self, self.subscribedAttrs, constants.mqtt.retries);
    });

    /* message event received when client receives a published packet */
    this.client.on('message', function (topic, message, packet) {
        // parse the machine type, the machine id, and the attribute out of the topic
        var [type, id, attr] = topic.split('/');

        const parsed = JSON.parse(message.toString());
        self._handleMessage.call(self, type, id, attr, parsed.data, parsed.seqval);
    });

    this.client.on('offline', function () {
        console.log('WARNING: mqtt client is offline');
    });

    this.client.on('error', function (error) {
        console.log('WARNING: mqtt client received an error');
    });
}
/**
 * set/unset attributes discovered by this node
 */
MQTTRegistry.prototype.discoverAttributes = function(dattrs) {
    if (this.client && this.client.connected) {
        this._subscribeWithRetries(dattrs, constants.mqtt.retries);
    } else {
        var self = this;
        setTimeout(self.discoverAttributes.bind(self), 
            constants.mqtt.retryInterval, dattrs);
    }
}
MQTTRegistry.prototype.stopDiscoveringAttributes = function(dattrs) {
    if (this.client && this.client.connected) {
        this._unsubscribeWithRetries(dattrs, constants.mqtt.retries);
    } else {
        var self = this;
        setTimeout(self.stopDiscoveringAttributes.bind(self), 
            constants.mqtt.retryInterval, dattrs);
    }
}
/**
 * set/unset discoverable attributes for this node
 */
MQTTRegistry.prototype.setAttributes = function(attrs, seqval) {
    for (var attr in attrs) {
        this._publish(attr, attrs[attr], seqval);
    }
}
MQTTRegistry.prototype.removeAttributes = function(attrs, seqval) {
    for (var attr in attrs) {
        this._unpublish(attr, seqval);
    }
}
/**
 * Closes the mqtt registry
 * --> Cleans up all publications on mqtt broker
 * --> Kills connection to broker
 */
MQTTRegistry.prototype.quit = function() {
    if (this.client && this.client.connected) {
        // unpublish on all attributes
        this.removeAttributes(this.publishedAttrs);
        // end connection
        this.client.end(false);
    } else {
        var self = this;
        setTimeout(self.quit.bind(self), 
            constants.mqtt.retryInterval);
    }
    this.client = null;
}

/* exports */
module.exports = MQTTRegistry;
