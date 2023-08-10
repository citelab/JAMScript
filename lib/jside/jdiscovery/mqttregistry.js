'use strict';
//==============================================================================
// Registers a node on the network using MQTT
//==============================================================================

var mqtt    = require("mqtt"),
  constants = require("../utils/constants"),
  {assert}   = require("console"),
  Registry  = require("./registry");

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
  this.client = undefined;

  // This is for reconnection
  // It should be noted that the customExitHook is transient and is set to undefined after called.
  // All of this is unfortunately a little specific to handling edge cases of reconnection.
  this.cancelConnection = false;
  this.customExitHook   = undefined;

  this.bypassMessageProcessing = false;

  /**
   * Attributes currently published. A map from attribute name
   * to { payload: attribute_value, dedupeId: deduplication_id } objects.
   */
  // I don't think we need this much longer
  this.publishedAttrs = {};
  this.publishedStatuses = {};
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


  this.messagesToPublish = {};
  this.statusesToRemove = {};

  // NOTE: naming could be better, this also subscribes to statuses
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
  overrideLastWill  = undefined,
  overrideMachType = undefined,
  cleanupOnConnect = false,
) {

  // Prevent this from being run twice!
  if(this.client != undefined)
    console.error(`MQTT ERROR: Cannot register a client twice (${mqttBrokerUrl})`);


  if(!mqttBrokerUrl.includes("mqtt://") && !mqttBrokerUrl.includes("tcp://")) {
    mqttBrokerUrl = "mqtt://"+mqttBrokerUrl;
}

  // create an mqtt client
  //console.log("-- test: Attempting to connect to mqtt broker: " + mqttBrokerUrl + " : " + JSON.stringify(this._getConnectionOptions()));
  //console.log("-- test: Attempting to connect to mqtt broker: " + mqttBrokerUrl + "   " + overrideLastWill);


  this.client = mqtt.connect(mqttBrokerUrl, this._getConnectionOptions(overrideLastWill, overrideMachType));
  this.brokerUrl = mqttBrokerUrl;
  // set up event listeners for the client
  this._prepareForEvents(cleanupOnConnect);
};

// This is a bit confusing to be honest.
MQTTRegistry.prototype.restartConnection = function(
  overrideLastWill = undefined,
  overrideMachType = undefined) {
  let self = this;

  self.customExitHook = () => {
    self.client = undefined;
    console.log("Intentional Reconnection: Connecting to Registry");
    self.registerAndDiscover(self.brokerUrl, overrideLastWill, overrideMachType);
  };


  if(this.connected) {
    this.disconnect();
  } else if(this.client != undefined) {
    // If we try to disconnect before connection happens
    this.cancelConnection = true;
  } else {
    console.error("ERROR: Attempt to restart connection when there is no connection.");
  }
}
 

MQTTRegistry.prototype.disconnect = function() {
  this.client.end();
  this.connected = false;
}

MQTTRegistry.prototype.cleanup = async function(){
  this.bypassMessageProcessing = true;

  // This is a bit of a hacky way to use promises.
  // We are doing this because we want to have the
  // resiolve called from a timeout which we want to be
  // able to extend
  var hackyResolve;
  let timeoutPromise = new Promise((resolve) => {
    hackyResolve = resolve;
  });

  var timeout = undefined;
  
  // The timeout is to detect when we stop receiving messages
  let that = this;
  function cullMessages(topic, message) {
    if(topic.at(0)=='/')
      return;

    if(message!="") {
      console.log("Culling: "+topic);
      that.client.publish(topic, null, {qos: 0, retain: true}, (err) => {
        if(err) {
          console.log(`Error: unable to delete topic '${topic}'`);
        }
      });

      if(timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(()=>{
        hackyResolve();
      }, 200);
    }
  }

  this.client.on("message", cullMessages);
  await new Promise((resolve) => {
    this.client.subscribe(`${this.app}/#`, (err, granted) => {
      if(err) {
        console.error("Error while trying to subscribe for broker cleanup!");
      } else {
        console.log(granted);
	timeout = setTimeout(()=>{
	    hackyResolve();
	}, 200);
        resolve();
      }
    })
  });

  await timeoutPromise;

  this.client.off("message", cullMessages);

  await new Promise((resolve) => {
    this.client.unsubscribe(`${this.app}/#`, (err) => {
      if(err) {
        console.error("Error while trying to unsubscribe for broker cleanup!");
      } else {
        resolve();
      }
    })
  });


  this.bypassMessageProcessing = false;
}

/**
 * A general helper for listening for events from the MQTT client
 */
MQTTRegistry.prototype._prepareForEvents = function (cleanupOnConnect) {
  var self = this;

  /* connect event emitted on successful connection or reconnection */
  this.client.on("connect", async function (connack) {
    console.log("-- test: Succesfully connected to MQTT Broker: " + self.brokerUrl);


    // Used when attempting to reconnect (likely to change will)
    // this is used when we want to change will but our initial connection hasn't happend yet
    if(self.cancelConnection) {
      console.log("Cancelling connection to "+ self.brokerUrl);
      self.cancelConnection = false;
      self.disconnect();
      return;
    }
    
    if(cleanupOnConnect)
      await self.cleanup();

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
          self.attrsToSubTo[machType][attr] = self.subscribedAttrs[machType][attr];
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
        JSON.parse(JSON.stringify(self.statusesToRemove)),
        constants.mqtt.retries
      );
    }

    // publish
    for (var attr in self.publishedStatuses) {
      self.messagesToPublish[attr] = self.publishedStatuses[attr];
    }
    self.publishedStatuses = {};
    for (var attr in self.messagesToPublish) {
      self._publishWithRetries(
        self,
        attr,
        self.messagesToPublish[attr].payload,
        self.messagesToPublish[attr].dedupeId,
        constants.mqtt.retries,
        self.messagesToPublish[attr].overrideMachType,
        self.messagesToPublish[attr].overrideId
      );
    }

    // unpublish
    for (var attr in self.statusesToRemove) {
      self._unpublishWithRetries(self, attr, constants.mqtt.retries);
    }

    self.connected = true;
  });

  /* message event received when client receives a published packet */
  this.client.on("message", function (topic, message, packet) {

    // This is communication transport.
    // Not sure if it is intentional that communication transport has this but it works.
    if(topic.at(0)=='/')
      return;

    if(self.bypassMessageProcessing)
      return;

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
      }
      
      return;
    }
    //console.log("-- test: Message Received " + message.toString() + " FROM "+self.brokerUrl);
    const parsedMsg = JSON.parse(message.toString());
    self._handleMessage(
      self,
      machType,
      machId,
      attr,
      parsedMsg.payload,
      parsedMsg.id,
      packet.retain
    );
  });

  this.client.on("close", function() {
    console.log(`WARNING: mqtt client (${self.brokerUrl}) CLOSED!`);
    self.emit("client-offline");
  });
  
  this.client.on("offline", function () {
    console.log(`WARNING: mqtt client (${self.brokerUrl}) is offline`);
    self.emit("client-offline");
  });

  this.client.on("error", function (error) {
    if(error.message.includes("ECONNREFUSED")) {
      console.log(`WARNING: failed to connect to (${self.brokerUrl}).`);
    } else if(error.message.includes("client disconnecting")) {
      console.log(`WARNING: mqtt client (${self.brokerUrl}) had connection closed!`);
      self.emit("client-offline");
    } else {
      console.log(`WARNING: mqtt client (${self.brokerUrl}) received an error: ${error.message}`);
    }

  });

  // callback of mqttclient.end() once dissasociation is complete.
  this.client.on('end', ()=>{
    if(self.customExitHook != undefined) {
      self.customExitHook();
      self.customExitHook = undefined;
    }
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
  dedupeId,
  retain
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
      dedupeId,
      retain
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
  
  // optimistically move these subscriptions from attrsToSubTo to subscribedAttrs
  for(var machType in dattrs) {
    for(var attr in dattrs[machType]) {
      delete self.attrsToSubTo[machType][attr];

      if(self.subscribedAttrs[machType][attr]) {
	delete dattrs[machType][attr];
	continue;
      }
      
      self.subscribedAttrs[machType][attr] = dattrs[machType][attr];
    }
  }

  for(var machType in dattrs) {
    for(var attr in dattrs[machType]) {
      subs[`${self.app}/${machType}/+/${attr}`] = { qos: self.subQos };
    }
  }

  if (Object.keys(subs).length === 0) {
    return;
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
  if (self.client && self.connected) {
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
	  dattrs,
          retries - 1
        );
      } else {
        self.emit("unsub-error", dattrs);
      }
    } else {

      for(var machType in dattrs) {
        for (var attr in dattrs[machType]) {
          delete self.subscribedAttrs[machType][attr];
          delete self.attrsToUnsubFrom[machType][attr];
        }
      }
    }
  });
};

MQTTRegistry.prototype.unsubscribe = function (self, dattrs) {
  if (self.client && self.connected) {
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
  overrideId = undefined,
  shouldRetain = true,
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
    { qos: self.pubQos, retain: shouldRetain },
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
            overrideId,
            shouldRetain
          );
        } else {
          self.emit("pub-error", attr, value, overrideMachType, overrideId);
        }
      } else if(shouldRetain) {
        // move the attribute from attrsToPublish to publishedAttrs
        self.publishedStatuses[attr] = {
          payload: value,
          dedupeId: dedupeId,
          overrideMachType: overrideMachType,
          overrideId: overrideId,
          shouldRetain: shouldRetain
        };

        delete self.messagesToPublish[attr];
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
  overrideId = undefined,
  shouldRetain = true
) {
  if (self.client && self.connected) {
    self._publishWithRetries(
      self,
      attr,
      value,
      dedupeId,
      constants.mqtt.retries,
      overrideMachType,
      overrideId,
      shouldRetain
    );
  }
  // if we're disconnected, then we'll automatically try to publish the attributes when we connect
};



/**
 * Helper for "un"-publishing an attribute (NOTE: this is a bit silly, we don't need two layers of retries)
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
        delete self.statusesToRemove[attr];
        delete self.publishedStatuses[attr];
      }
    }
  );
};

MQTTRegistry.prototype.unpublish = function (
  self,
  attr,
  overrideMachType = undefined,
  overrideId = undefined,
) {
  if (self.client && self.connected) {

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
MQTTRegistry.prototype._getConnectionOptions = function (overrideLastWill = undefined, overrideMachType = undefined) {

  let machType = overrideMachType ? overrideMachType : this.machType;

  // create the will
  var will = undefined;
  if(overrideLastWill == undefined) {
    will = {
      topic: this.app + "/" + machType + "/" + this.id + "/status",
      payload: JSON.stringify({ payload: "offline" }),
      qos: this.pubQos,
      retain: true,
    };
  } else {
    will = overrideLastWill;
  }

  // set and return the connection options
  return {
    clientId: random.uuid4(),
    keepalive: constants.mqtt.keepAlive,
    clean: true,
    connectTimeout: constants.mqtt.connectionTimeout,
    will: will!=='none' ? will : undefined
  };
};

//==============================================================================
// Custom attribute publication/discovery
//==============================================================================

/**
 * Add and publish attributes for this node
 */

// Retains
MQTTRegistry.prototype.setStatuses = function(
  attrs,
  dedupeId,
  overrideMachType = undefined,
  overrideId = undefined,
) {
  for(var attr in attrs) {

    delete this.statusesToRemove[attr];

    // Skip if this exact status is already currently published
    this.messagesToPublish[attr] = {
      payload: attrs[attr],
      dedupeId: dedupeId,
      overrideMachType: overrideMachType,
      overrideId: overrideId,
      shouldRetain: true
    };
    if (this.client && this.connected) {
      // try to publish the attribute
      this._publishWithRetries(
        this,
        attr,
        attrs[attr],
        dedupeId,
        constants.mqtt.retries,
        overrideMachType,
        overrideId,
        true // should retain
      );
    }
  }
}

// Does Not Retain
// Does not internally keep track of attributes
MQTTRegistry.prototype.addAttributes = function (
  attrs,
  dedupeId,
  overrideMachType = undefined,
  overrideId = undefined,
  forcePublish = false
) {

  for (var attr in attrs) {
    // just in case this is in the queue for removal...

    this.messagesToPublish[attr] = {
      payload: attrs[attr],
      dedupeId: dedupeId,
      overrideMachType: overrideMachType,
      overrideId: overrideId,
      shouldRetain: false
    };

    if (this.client && this.connected) {
      // try to publish the attribute
      this._publishWithRetries(
        this,
        attr,
        attrs[attr],
        dedupeId,
        constants.mqtt.retries,
        overrideMachType,
        overrideId,
        false // Do not retain
      );
    }
  }
};


MQTTRegistry.prototype.removeStatuses = function (
  attrs,
  overrideMachType = undefined,
  overrideId = undefined
) {
  for(var attr in attrs) {
    delete this.messagesToPublish[attr];

    if(this.publishedMessages.hasOwnProperty(attr)) {
      this._unpublishWithRetries(
        this,
        attr,
        constants.mqtt.retries,
        overrideMachType,
        overrideId
      );
    } else {
      // NOTE: it is quite possible that we may want to remove a status which was not published this session
      console.log(`Attempt to remove status '${attr}' which has not been published by us in this session`);
    }
  }
}

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
  if (changesToSubs && this.client && this.connected) {
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

  if (changesToSubs && this.client && this.connected) {
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
