//==============================================================================
// Registers a node on the network using MQTT
//==============================================================================

var mqtt = require("mqtt"),
  constants = require("../utils/constants"),
  Registry = require("./registry");

const { Random, MersenneTwister19937 } = require("random-js");
const random = new Random(MersenneTwister19937.autoSeed());

function MQTTRegistry(app, machType, id, port, loc, subQos, pubQos) {
  Registry.call(this, app, machType, id, port, loc);
  // the quality of service to use for subscriptions
  this.subQos = subQos;
  // the quality of service to use for publications
  this.pubQos = pubQos;
  this.brokerUrl = undefined;
  this.connected = false;
  /** 
   * Attributes currently published. A map from attribute name
   * to { payload: attribute_value, dedupeId: deduplication_id } objects.
   */
  this.publishedAttrs = {};
  // attributes that have already been subscribed to
  this.subscribedAttrs = {
    device: {},
    fog: {},
    cloud: {},
    local_registry: {},

    global_registry: {},
  };
  /**
   * Attributes to be published on (re)connection. A map from attribute name
   * to { payload: attribute_value, dedupeId: deduplication_id } objects.
   */
  this.attrsToPublish = {};
  // attributes to remove when reconnecting
  this.attrsToRemove = {};
  // attributes to subscribe to on (re)connection
  this.attrsToSubTo = {
    device: {},
    fog: {},
    cloud: {},
    local_registry: {},
    global_registry: {},
  };
  // attributes to unsubscribe from on reconnection
  this.attrsToUnsubFrom = {
    device: {},
    fog: {},
    cloud: {},
    local_registry: {},
    global_registry: {},
  };
}

/* MQTTRegistry inherits from Registry */
MQTTRegistry.prototype = Object.create(Registry.prototype);
MQTTRegistry.prototype.constructor = MQTTRegistry;

/**
 * Performs basic registration and discovery
 */
MQTTRegistry.prototype.registerAndDiscover = function (
  mqttBrokerUrl    = constants.mqtt.brokerUrl,
  includeLastWill  = true,
  overrideMachType = undefined
) {

  // create an mqtt client
  //console.log("-- test: Attempting to connect to mqtt broker: " + mqttBrokerUrl + " : " + JSON.stringify(this._getConnectionOptions()));
  console.log("-- test: Attempting to connect to mqtt broker: " + mqttBrokerUrl + "   " + includeLastWill);

  this.client = mqtt.connect(mqttBrokerUrl, this._getConnectionOptions(includeLastWill, overrideMachType));
  this.brokerUrl = mqttBrokerUrl;
  // set up event listeners for the client
  this._prepareForEvents();
};

MQTTRegistry.prototype.disconnect = function() {
  this.client.end();
  this.connected = false;
}

/**
 * A general helper for listening for events from the MQTT client
 */
MQTTRegistry.prototype._prepareForEvents = function () {
  var self = this;

  /* connect event emitted on successful connection or reconnection */
  this.client.on("connect", function (connack) {
    console.log("-- test: Succesfully connected to MQTT Broker: " + self.brokerUrl);
    if (!connack.sessionPresent) {
      /*
       * session is not present - subscriptions start from scratch but
       * old publications could still be persisted on the broker
       */
      // reset attrsToUnsubFrom
      self.attrsToUnsubFrom = {
        device: {},
        fog: {},
        cloud: {},
        local_registry: {},
        global_registry: {},
      };
      
      // subscribe
      // combine subscribedAttrs and attrsToSubTo so that we can subscribe to all of them
      for(var machType in self.subscribedAttrs) {
        for(var attr in self.subscribedAttrs[machType]) {
          self.attrsToSubTp[machType] = self.subscribedAttrs[machType][attr];
        }
      }

      self.subscribedAttrs = {
        device: {},
        fog: {},
        cloud: {},
        local_registry: {},
        global_registry: {},
      };
      self._subscribeWithRetries(
        self,
        JSON.parse(JSON.stringify(self.attrsToSubTo)),
        constants.mqtt.retries
      );
    } else {
      /*
       * session is present - old subscriptions are still there so we only need to subscribe to new ones
       * but we also need to unsubscribe from attrsToUnsubFrom
       * we make no assumptions about the state of publications
       */
      // subscribe
      self._subscribeWithRetries(
        self,
        JSON.parse(JSON.stringify(self.attrsToSubTo)),
        constants.mqtt.retries
      );
      // unsubscribe
      self._unsubscribeWithRetries(
        self,
        JSON.parse(JSON.stringify(self.attrsToRemove)),
        constants.mqtt.retries
      );
    }

    // publish
    for (var attr in self.publishedAttrs) {
      self.attrsToPublish[attr] = self.publishedAttrs[attr];
    }
    self.publishedAttrs = {};
    for (var attr in self.attrsToPublish) {
      self._publishWithRetries(
        self,
        attr,
        self.attrsToPublish[attr].payload,
        self.attrsToPublish[attr].dedupeId,
        constants.mqtt.retries,
        self.attrsToPublish[attr].overrideMachType,
        self.attrsToPublish[attr].overrideId
      );
    }
    // unpublish
    for (var attr in self.attrsToRemove) {
      self._unpublishWithRetries(self, attr, constants.mqtt.retries);
    }

    self.connected = true;
  });

  /* message event received when client receives a published packet */
  this.client.on("message", function (topic, message, packet) {
    // parse the mach type, the mach id, and the attribute out of the topic
    var components = topic.split("/");
    var machType = components[1];
    var machId = components[2];
    var attr = components[3];

    // if the message is an empty string, then this is the result of an "unpublish".
    // i.e. another node unpublished an attribute and we are now being notified.
    if (message.toString() === "") {
      var eventName;
      if (self.subscribedAttrs[machType].hasOwnProperty(attr)) {
        eventName = self.subscribedAttrs[machType][attr].onRemove;
      } else if (self.subscribedAttrs[machType].hasOwnProperty("+")) {
        eventName = self.subscribedAttrs[machType]["+"].onRemove;
      }

      if (eventName !== undefined) {
        self.emit("attr-removed", attr, eventName, machId);
      } else {
        console.log(
          "Message received yet we are not subscribed to this message, or shouldn't be... This should not be because we are still awaiting a subscription confirmation for this message, as this issue has been fixed. If you ever see this message, then something is probably wrong."
        );
      }
      return;
    }
    console.log("-- test: Message Received " + message.toString() + " FROM "+self.brokerUrl); // @FIX Remove this test code
    const parsedMsg = JSON.parse(message.toString());
    self._handleMessage(
      self,
      machType,
      machId,
      attr,
      parsedMsg.payload,
      parsedMsg.id
    );
  });

  this.client.on("offline", function () {
    console.log("WARNING: mqtt client is offline");
    self.emit("client-offline");
  });

  this.client.on("error", function (error) {
    console.log("WARNING: mqtt client received an error: " + error);
  });
};

/**
 * Handles receipt of a message from the MQTT broker. Finds the subscription that
 * the message corresponds to and executes the appropriate action.
 */
MQTTRegistry.prototype._handleMessage = function (
  self,
  machType,
  machId,
  attr,
  payload,
  dedupeId
) {
  var eventName;
  if (self.subscribedAttrs[machType].hasOwnProperty(attr)) {
    if (attr === "status") {
      if (payload === "offline") {
        eventName = self.subscribedAttrs[machType].status.offline;
        // pass a dedupeId of zero for node down events
        dedupeId = 0;
      } else {
        eventName = self.subscribedAttrs[machType].status.online;
      }
    } else {
      eventName = self.subscribedAttrs[machType][attr].onAdd;
    }
  } else if (self.subscribedAttrs[machType].hasOwnProperty("+")) {
    eventName = self.subscribedAttrs[machType]["+"].onAdd;
  }

  if (eventName !== undefined) {
    self.emit(
      "discovery",
      attr,
      eventName,
      machType,
      machId,
      payload,
      dedupeId
    );
  } else {
    console.log(
      "Message received yet we are not subscribed to this message channel, or shouldn't be... This should not be because we are still awaiting a subscription confirmation for this message, as this issue has been fixed. If you ever see this message, then something is probably wrong."
    );
  }
};

/**
 * Helper for setting up subscriptions to the broker with retries
 */
MQTTRegistry.prototype._subscribeWithRetries = function (
  self,
  dattrs,
  retries
) {
  // format subscriptions to be sent to the broker
  var subs = {};

  for(var machType in dattrs) {
    for(var attr in dattrs[machType]) {
      subs[`${self.app}/${machType}/+/${attr}`] = { qos: self.subQos };
    }
  }

  if (Object.keys(subs).length === 0) {
    return;
  }

  // optimistically move these subscriptions from attrsToSubTo to subscribedAttrs
  for(var machType in dattrs) {
    for(var attr in dattrs[machType]) {
      delete self.attrsToSubTo[machType][attr];
      self.subscribedAttrs[machType][attr] = dattrs[machType][attr];
    }
  }

  // perform subscriptions
  self.client.subscribe(subs, function (err, granted) {
    if (err) {
      if (retries !== 0) {
        setTimeout(
          self._subscribeWithRetries,
          constants.mqtt.retryInterval,
          self,
          dattrs,
          retries - 1
        );
      } else {
        // move all attributes back to attrsToSubTo and emit an error

        for(var machType in dattrs) {
          for(var attr in dattrs[machType]) {
            delete self.subscribedAttrs[machType][attr];
            self.attrsToSubTo[machType] = dattrs[machType][attr];
          }
        }
        
        self.emit("sub-error", dattrs);
      }
    } else {
      // move any attrs that were denied from subscribedAttrs to attrsToSubTo and
      // emit an event indicating the attributes that were denied
      var components, machType, attr;
      for (var i = 0; i < granted.length; i++) {
        components = granted[i].topic.split("/");
        machType = components[1];
        attr = components[3];
        delete dattrs[machType][attr];
      }

      //NOTE(Ethan): the mach type test is not strictly necessary
      for(var machType in dattrs) {
        for(var attr in dattrs[machType]) {
          delete self.subscribedAttrs[machType][attr];
          self.attrsToSubTo[machType][attr] = dattrs[machType][attr];
        }
      }

      // report any subscriptions that weren't granted
      if (
        Object.keys(dattrs.device).length !== 0 ||
        Object.keys(dattrs.fog).length !== 0 ||
        Object.keys(dattrs.cloud).length !== 0 ||
        Object.keys(dattrs.local_registry).length !== 0 ||
        Object.keys(dattrs.global_registry).length !== 0
      ) {
        self.emit("subs-denied", dattrs);
      }
    }
  });
};

MQTTRegistry.prototype.subscribe = function (self, dattrs) {
  if (self.client && self.client.connected) {
    self._subscribeWithRetries(self, dattrs, constants.mqtt.retries);
  }
  // if we're disconnected, then we'll automatically try to subscribe to the attributes when we connect
};

/**
 * Unsubscribe from a series of topics
 */
MQTTRegistry.prototype._unsubscribeWithRetries = function (
  self,
  dattrs,
  retries
) {
  var topics = [];

  for(var machType in dattrs) {
    for(var attr in dattrs[machType]) {
      topics.push(`${self.app}/${machType}/+/${attr}`);
    }
  }

  if (topics.length === 0) {
    return;
  }

  self.client.unsubscribe(topics, function (err) {
    if (err) {
      if (retries > 0) {
        setTimeout(
          self._unsubscribeWithRetries,
          constants.mqtt.retryInterval,
          self,
          topics,
          retries - 1
        );
      } else {
        self.emit("unsub-error", dattrs);
      }
    } else {

      for(var machType in dattrs) {
        for (var attr in dattrs[machtype]) {
          delete self.subscribedAttrs[machtype][attr];
          delete self.attrsToUnsubFrom[machtype][attr];
        }
      }
    }
  });
};

MQTTRegistry.prototype.unsubscribe = function (self, dattrs) {
  if (self.client && self.client.connected) {
    self._unsubscribeWithRetries(self, dattrs, constants.mqtt.retries);
  }
  // if we're disconnected, then we'll automatically try to unsubscribe from the attributes when we connect
};

/**
 * Helper for publishing an attribute with retries.
 * attr - the name of the attribute
 * value - the value of the attribute
 * dedupeId - the ID to publish with the attributes for deduplication purposes on
 *  on the receiving node
 * retries - the number of retries, if publishing fails
 */
MQTTRegistry.prototype._publishWithRetries = function (
  self,
  attr,
  value,
  dedupeId,
  retries,
  overrideMachType = undefined,
  overrideId = undefined
) {
  var msg;
  if (value instanceof Function) {
    msg = JSON.stringify({ payload: value(), id: dedupeId });
  } else {
    msg = JSON.stringify({ payload: value, id: dedupeId });
  }
  
  self.client.publish( 
    self.app +
      "/" +
      (overrideMachType || self.machType) +
      "/" +
      (overrideId || self.id) +
      "/" +
      attr,
    msg,
    { qos: self.pubQos, retain: true },
    function (err) {
      if (err) {
        if (retries === 0) {
          setTimeout(
            self._publishWithRetries,
            constants.mqtt.retryInterval,
            self,
            attr,
            value,
            dedupeId,
            retries - 1,
            overrideMachType,
            overrideId
          );
        } else {
          self.emit("pub-error", attr, value, overrideMachType, overrideId);
        }
      } else {
        // move the attribute from attrsToPublish to publishedAttrs
        self.publishedAttrs[attr] = {
          payload: value,
          dedupeId: dedupeId,
          overrideMachType: overrideMachType,
          overrideId: overrideId,
        };
        delete self.attrsToPublish[attr];
      }
    }
  );
};

MQTTRegistry.prototype.publish = function (
  self,
  attr,
  value,
  dedupeId,
  overrideMachType = undefined,
  overrideId = undefined
) {
  if (self.client && self.client.connected) {
    self._publishWithRetries(
      self,
      attr,
      value,
      dedupeId,
      constants.mqtt.retries,
      overrideMachType,
      overrideId
    );
  }
  // if we're disconnected, then we'll automatically try to publish the attributes when we connect
};

/**
 * Helper for "un"-publishing an attribute
 */
MQTTRegistry.prototype._unpublishWithRetries = function (
  self,
  attr,
  retries,
  overrideMachType = undefined,
  overrideId = undefined
) {
  self.client.publish(
    self.app + "/" + overrideMachType ||
      self.machType + "/" + overrideId ||
      self.id + "/" + attr,
    null,
    { qos: self.pubQos, retain: true },
    function (err) {
      if (err) {
        if (retries > 0) {
          setTimeout(
            self._unpublishWithRetries,
            constants.mqtt.retryInterval,
            self,
            attr,
            retries - 1,
            overrideMachType,
            overrideId
          );
        } else {
          self.emit("unpub-error", attr, overrideMachType, overrideId);
        }
      } else {
        // remove the attribute from attrsToRemove and publishedAttrs
        delete self.attrsToRemove[attr];
        delete self.publishedAttrs[attr];
      }
    }
  );
};

MQTTRegistry.prototype.unpublish = function (
  self,
  attr,
  overrideMachType = undefined,
  overrideId = undefined
) {
  if (self.client && self.client.connected) {
    self._unpublishWithRetries(
      self,
      attr,
      constants.mqtt.retries,
      overrideMachType,
      overrideId
    );
  }
  // if we're disconnected, then we'll automatically try to publish the attributes when we connect
};

/**
 * Returns connection options to the mqtt broker contingent upon the connecting node
 * takes as arguments the name of the application, the type of the machine, and the
 * id of the machine
 */
MQTTRegistry.prototype._getConnectionOptions = function (includeLastWill = true, overrideMachType = undefined) {

  let machType = overrideMachType ? overrideMachType : this.machType;

  // create the will
  var will = {
    topic: this.app + "/" + machType + "/" + this.id + "/status",
    payload: JSON.stringify({ payload: "offline" }),
    qos: this.pubQos,
    retain: true,
  };

  // set and return the connection options
  return {
    clientId: random.uuid4(),
    keepalive: constants.mqtt.keepAlive,
    clean: false,
    connectTimeout: constants.mqtt.connectionTimeout,
    will: includeLastWill ? will : undefined
  };
};

//==============================================================================
// Custom attribute publication/discovery
//==============================================================================

/**
 * Add and publish attributes for this node
 */
MQTTRegistry.prototype.addAttributes = function (
  attrs,
  dedupeId,
  overrideMachType = undefined,
  overrideId = undefined,
  forcePublish = false
) {

  for (var attr in attrs) {
    // just in case this is in the queue for removal...
    delete this.attrsToRemove[attr];
    // check that it's not already published
    if (
      !this.publishedAttrs.hasOwnProperty(attr) ||
      this.publishedAttrs[attr].overrideMachType !== overrideMachType ||
      this.publishedAttrs[attr].overrideId !== overrideId ||
      forcePublish
    ) {
      this.attrsToPublish[attr] = {
        payload: attrs[attr],
        dedupeId: dedupeId,
        overrideMachType: overrideMachType,
        overrideId: overrideId,
      };
      if (this.client && this.client.connected) {
        // try to publish the attribute
        this._publishWithRetries(
          this,
          attr,
          attrs[attr],
          dedupeId,
          constants.mqtt.retries,
          overrideMachType,
          overrideId
        );
      }
    }
  }
};

/**
 * Unpublishes the given attributes.
 * attrs - an array of the names (strings) of the attributes to remove.
 */
MQTTRegistry.prototype.removeAttributes = function (
  attrs,
  overrideMachType = undefined,
  overrideId = undefined
) {
  for (var i = 0; i < attrs.length; i++) {
    // remove it from attrsToPublish, if need be
    delete this.attrsToPublish[attrs[i]];
    if (this.publishedAttrs.hasOwnProperty(attrs[i])) {
      this.attrsToRemove[attrs[i]] = {
        overrideMachType,
        overrideId,
      };
      if (this.client && this.client.connected) {
        // try to remove it
        this._unpublishWithRetries(
          this,
          attrs[i],
          constants.mqtt.retries,
          overrideMachType,
          overrideId
        );
      }
    }
  }
};

MQTTRegistry.prototype.discoverAttributes = function (dattrs) {
  var subs = {
    device: {},
    fog: {},
    cloud: {},
    local_registry: {},
    global_registry: {},
  };
  var changesToSubs = false;

  for(var machType in dattrs) {

    for (var attr in dattrs[machType]) {
      // in case this attr is queued up to be unsubscribed from
      delete this.attrsToUnsubFrom[machType][attr];
      if (!this.subscribedAttrs[machType].hasOwnProperty(attr)) {
        // try to subscribe to it
        changesToSubs = true;
        subs[machType][attr] = dattrs[machType][attr];
        this.attrsToSubTo[machType][attr] = dattrs[machType][attr];
      }
    }      
  }
  if (changesToSubs && this.client && this.client.connected) {
    this._subscribeWithRetries(this, subs, constants.mqtt.retries);
  }
};

MQTTRegistry.prototype.stopDiscoveringAttributes = function (dattrs) {
  var unsubs = {
    device: {},
    fog: {},
    cloud: {},
    local_registry: {},
    global_registry: {},
  };
  var changesToSubs = false;

  for(var machType in dattrs) {
    for(var attr of dattrs[machType]) {
      delete this.attrsToSubTo[machType][attr];
      if (this.subscribedAttrs.hasOwnProperty(attr)) {
        this.attrsToUnsubFrom[machType][attr] = null;
        changesToSubs = true;
        unsubs[machType][attr] = null;
      }
    }
  }

  if (changesToSubs && this.client && this.client.connected) {
    this._unsubscribeWithRetries(this, unsubs, constants.mqtt.retries);
  }
};

/**
 * Closes the client, executing the callback upon completion
 */

MQTTRegistry.prototype.quit = function(cb) {
    if (this.client) {
        console.log("Closing... ");
        this.client.end(true, cb);
    }
}


/* exports */
module.exports = MQTTRegistry;