var EventEmitter = require("events"),
  globals = require("../utils/constants").globals,
  constants = require("../utils/constants"),
  MQTTRegistry = require("./mqttregistry"),
  os = require("os");

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
      if (nielm[n].family === "IPv4" && nielm[n].internal === false)
        return nielm[n].address;
    }
  }
  return globals.localhost;
}

function getUrlFromIpAndPort(ip, port) {
  return `mqtt://${ip}:${port}`;
}

//==============================================================================
// Registrar Class
// This class is the interface between the application and the MQTT, mDNS, and
// local storage registries
//==============================================================================

function Registrar(
  app,
  machType,
  id,
  port,
  loc,
  config,
  localMqttBrokerUrl,
  initialLocalRegistryUrl = undefined,
  initialLocalRegistryId = undefined,
  globalRegistryId = undefined
) {
  // the name of the application
  this.app = app;
  // the type of the machine the registar is running on (device, fog, or cloud)
  this.machType = machType;
  // the id of the machine
  this.id = id;
  // the port the program is running on
  if (typeof port === "string") {
    port = parseInt(port);
  }
  if (!(typeof port === "number")) {
    throw new Error("port is not a number");
  }
  this.port = port;
  this.loc = loc;
  // The URL of the MQTT broker this node operates.
  this.localMqttBrokerUrl = localMqttBrokerUrl;

  this.subQos = this.machType == globals.NodeType.DEVICE ? 0 : 1;
  this.pubQos = this.machType == globals.NodeType.DEVICE ? 0 : 1;

  if (this.localMqttBrokerUrl)
    this.localMqttClient = new MQTTRegistry(
      app,
      machType,
      id,
      port,
      this.subQos,
      this.pubQos
    );

  if (config && config.hasOwnProperty("eliminateDuplicates")) {
    this.eliminateDuplicates = config.eliminateDuplicates;
  } else {
    // by default, eliminate duplicates
    this.eliminateDuplicates = false;
  }

  /*
  This map contains the mapping between local registry IDs to their attributes.
  {
    "<ID>": {
      url: <string>,
      mqttClient: <Optional>
    }
  }
  Notice that this map should be the same across the entire app.
   */
  this.localRegistriesMap = new Map();
  this.connectedRegistries = new Set();
  this.globalRegistryId = globalRegistryId;

  // If the current node is not a cloud nor a global registry,
  // then it must be connected to a local registry to receive info
  // from the cloud.
  if (
    initialLocalRegistryUrl &&
    initialLocalRegistryUrl !== this.localMqttBrokerUrl
  ) {
    this.localRegistriesMap.set(initialLocalRegistryId, {
      url: initialLocalRegistryUrl,
      mqttClient: new MQTTRegistry(
        app,
        machType,
        id,
        port,
        this.subQos,
        this.pubQos
      ),
      timestamp: Date.now(),
    });
  } else if (
    initialLocalRegistryUrl &&
    initialLocalRegistryUrl === this.localMqttBrokerUrl
  ) {
    this.localRegistriesMap.set(initialLocalRegistryId, {
      url: initialLocalRegistryUrl,
      mqttClient: this.localMqttClient,
      timestamp: Date.now(),
    });
  }

  // Only the local registry needs to connect to the global registry
  // explicitly.
  this.globalMqttClient = undefined;

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
  this.reservedAttrs = ["status", "lastCheckIn", "createdAt", "updatedAt"];

  // whether or not this registrar has been started
  this.started = false;

  /**
   * Set up default attributes, which are the same for devices, fogs, and clouds.
   * The only default attribute is 'status'.
   */
  this.addAttributes(
    {
      status: function () {
        return {
          port: port,
          ip: getIPv4Address(),
          loc: loc,
          timestamp: Date.now(),
        };
      },
    },
    true
  );

  /**
   * Prep the default discoveries to be made by a node
   */
  if (this.machType === globals.NodeType.DEVICE) {
    // default discoveries:
    // devices subscribes to cloud, local_registry, and fog on the local registries.
    this.availableFogs = new Map();
    this.connectedFogs = new Map();

    if (initialLocalRegistryId) {
      this.discoverAttributes(
        {
          fog: {
            status: {
              online: "fog-up",
              offline: "fog-down",
            },
          },
          cloud: {
            status: {
              online: "cloud-up",
              offline: "cloud-down",
            },
          },
          local_registry: {
            status: {
              online: "local-registry-up",
              offline: "local-registry-down",
            },
          },
        },
        this.localRegistriesMap.get(initialLocalRegistryId).mqttClient
      );
    }
  } else if (this.machType === globals.NodeType.FOG) {
    // default discoveries:
    // fog subscribes to cloud and local registries
    // on its initial local registry.

    if (initialLocalRegistryId) {
      this.discoverAttributes(
        {
          cloud: {
            status: {
              online: "cloud-up",
              offline: "cloud-down",
            },
          },
          local_registry: {
            status: {
              online: "local-registry-up",
              offline: "local-registry-down",
            },
          },
        },
        this.localRegistriesMap.get(initialLocalRegistryId).mqttClient
      );
    }
  } else if (
    this.machType === globals.NodeType.CLOUD ||
    this.machType === globals.NodeType.GLOBAL_REGISTRY
  ) {
    // From our point of view, the cloud is a global registry per se.
    this.discoverAttributes({
      local_registry: {
        status: {
          online: "local-registry-up",
          offline: "local-registry-down",
        },
      },
    });
  } else if (this.machType === globals.NodeType.LOCAL_REGISTRY) {
    // For a local registry, it needs to re-publish what's given by
    // the global registry, word for word.
    // Also, it needs to subscribe to `fog` and `device` on its own broker.
    this.globalMqttClient = new MQTTRegistry(
      app,
      machType,
      id,
      port,
      this.subQos,
      this.pubQos
    );
    this.connectedFogsAndDevices = new Map();
    this.connectedFogsAndDevices.set("fog", new Map());
    this.connectedFogsAndDevices.set("device", new Map());

    // Subscribe to the following attributes
    // on the global MQTT broker.
    this.discoverAttributes(
      {
        cloud: {
          status: {
            online: "cloud-up",
            offline: "cloud-down",
          },
          "+": {
            onAdd: "cloud-publishes-general-info",
            onRemove: "cloud-un-publishes-general-info",
          },
        },
        global_registry: {
          status: {
            online: "global-registry-up",
            offline: "global-registry-down",
          },
        },
        local_registry: {
          status: {
            online: "local-registry-up",
            offline: "local-registry-down",
          },
        },
      },
      this.globalMqttClient
    );

    // Subscribe to `fog` and `device` on
    // its own MQTT broker.
    this.discoverAttributes(
      {
        device: {
          status: {
            online: "device-up",
            offline: "device-down",
          },
        },
        fog: {
          status: {
            online: "fog-up",
            offline: "fog-down",
          },
        },
      },
      this.localMqttClient
    );

    this.addAttributes(
      {
        status: function () {
          return {
            port: port,
            ip: getIPv4Address(),
            loc: loc,
            timestamp: Date.now(),
          };
        },
      },
      true,
      this.globalMqttClient
    );
  }

  // listen for events from the Registries
  if (
    this.machType !== constants.globals.NodeType.GLOBAL_REGISTRY &&
    this.machType !== constants.globals.NodeType.CLOUD
  ) {
    this._installDefaultCallbacksToMqttClient(
      this.localMqttClient,
      this.localMqttBrokerUrl,
      this.id,
      this.machType
    );
  }
  this._installDefaultCallbacksToMqttClient(
    this.globalMqttClient,
    constants.mqtt.brokerUrl,
    this.globalRegistryId,
    constants.globals.NodeType.GLOBAL_REGISTRY
  );
  if (
    initialLocalRegistryId &&
    initialLocalRegistryUrl !== this.localMqttBrokerUrl
  )
    this._installDefaultCallbacksToMqttClient(
      this.localRegistriesMap.get(initialLocalRegistryId).mqttClient,
      initialLocalRegistryUrl,
      initialLocalRegistryId,
      constants.globals.NodeType.LOCAL_REGISTRY
    );
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
Registrar.prototype.registerAndDiscover = function (options) {
  if (options) {
    if (typeof options !== "object") {
      throw new Error("options must be an object - see the docs");
    }

    if (options.attrsToAdd) {
      this.addAttributes(options.attrsToAdd);
    }

    if (options.attrsToDiscover) {
      this.discoverAttributes(options.attrsToDiscover);
    }
  }

  if (!this.started) {
    const registeredClients = new Set();

    if (this.localMqttClient) {
      this.localMqttClient.registerAndDiscover(this.localMqttBrokerUrl);
      registeredClients.add(this.id);
    }

    if (
      this.globalMqttClient &&
      this.localMqttBrokerUrl !== this.globalMqttClient
    ) {
      this.globalMqttClient.registerAndDiscover(constants.mqtt.brokerUrl);
      registeredClients.add(this.globalRegistryId);
    }

    this.localRegistriesMap.forEach(
      (localRegistryAttribute, localRegistryId) => {
        const { url, mqttClient } = localRegistryAttribute;
        if (!registeredClients.has(localRegistryId)) {
          mqttClient.registerAndDiscover(url);
          registeredClients.add(localRegistryId);
        }
      }
    );
    this.started = true;
    this.connectedRegistries = new Set([
      ...this.connectedRegistries,
      ...registeredClients,
    ]);
  }
};

/**
 * Connect to a new local registry, given its URL.
 * @param {str} localRegistryUrl
 * @param {str} localRegistryId
 */
Registrar.prototype.connectToNewLocalRegistry = function (
  localRegistryUrl,
  localRegistryId
) {
  if (!localRegistryUrl)
    throw new Error(
      `The URL of the local registry(${localRegistryId}) to connect to cannot be empty.`
    );

  if (this.connectedRegistries.has(localRegistryId)) {
    throw new Error(
      `The local registry (${localRegistryId}) is already connected.`
    );
  }

  if (localRegistryUrl === constants.mqtt.brokerUrl) {
    throw new Error("Cannot connect to the global registry via this API.");
  }

  const mqttClient = new MQTTRegistry(
    this.app,
    this.machType,
    this.id,
    this.port,
    this.subQos,
    this.pubQos
  );

  if (this.machType === globals.NodeType.DEVICE) {
    this.discoverAttributes(
      {
        fog: {
          status: {
            online: "fog-up",
            offline: "fog-down",
          },
        },
        cloud: {
          status: {
            online: "cloud-up",
            offline: "cloud-down",
          },
        },
        local_registry: {
          status: {
            online: "local-registry-up",
            offline: "local-registry-down",
          },
        },
      },
      mqttClient
    );
  } else if (this.machType === globals.NodeType.FOG) {
    this.discoverAttributes(
      {
        cloud: {
          status: {
            online: "cloud-up",
            offline: "cloud-down",
          },
        },
        local_registry: {
          status: {
            online: "local-registry-up",
            offline: "local-registry-down",
          },
        },
      },
      mqttClient
    );
  }

  this._installDefaultCallbacksToMqttClient(
    mqttClient,
    localRegistryUrl,
    localRegistryId,
    constants.globals.NodeType.LOCAL_REGISTRY
  );

  const that = this;

  this.addAttributes(
    {
      status: function () {
        return {
          port: that.port,
          ip: getIPv4Address(),
          loc: that.loc,
          timestamp: Date.now(),
        };
      },
    },
    true,
    mqttClient
  );

  this.localRegistriesMap.set(localRegistryId, {
    url: localRegistryUrl,
    mqttClient: mqttClient,
    timestamp: Date.now(),
  });

  mqttClient.registerAndDiscover(localRegistryUrl);
  this.connectedRegistries.add(localRegistryId);
};

Registrar.prototype.disconnectFromLocalRegistry = function (nodeId) {
  if (this.connectedRegistries.has(nodeId) && nodeId != this.globalRegistryId) {
    const { mqttClient } = this.localRegistriesMap.get(nodeId);
    mqttClient.disconnect();
    this.connectedRegistries.delete(nodeId);
  }
};

Registrar.prototype.connectToNewFog = function (nodeId) {
  const { ip, port } = this.availableFogs.get(nodeId);

  const fogUrl = getUrlFromIpAndPort(ip, port);
  const mqttClient = new MQTTRegistry(
    this.app,
    this.machType,
    this.id,
    this.port,
    this.subQos,
    this.pubQos
  );

  this.discoverAttributes(
    {
      "+": {
        onAdd: "fog-publishes-general-info",
        onRemove: "fog-un-publishes-general-info",
      },
    },
    mqttClient
  );

  const that = this;

  this.addAttributes(
    {
      status: function () {
        return {
          port: that.port,
          ip: getIPv4Address(),
          loc: that.loc,
          timestamp: Date.now(),
        };
      },
    },
    true,
    mqttClient
  );

  this._installDefaultCallbacksToMqttClient(
    mqttClient,
    fogUrl,
    nodeId,
    constants.globals.NodeType.FOG
  );

  mqttClient.registerAndDiscover(fogUrl);
  this.connectedFogs.set(nodeId, {
    url: fogUrl,
    mqttClient: mqttClient,
    timestamp: Date.now(),
  });
};

Registrar.prototype.disconnectFromFog = function (nodeId) {
  if (this.connectedFogs.has(nodeId)) {
    this.connectedFogs.get(nodeId).mqttClient.disconnect();
    this.connectedFogs.delete(nodeId);
  }
};

Registrar.prototype.connectToGlobalRegistryForLocalRegistriesDiscovery =
  function (timeout = 10000) {
    if (!this.globalMqttClient || !this.globalMqttClient.connected) {
      this.globalMqttClient = new MQTTRegistry(
        this.app,
        this.machType,
        this.id,
        this.port,
        this.subQos,
        this.pubQos
      );

      this.discoverAttributes(
        {
          local_registry: {
            status: {
              online: "local-registry-up",
              offline: "local-registry-down",
            },
          },
        },
        this.globalMqttClient
      );

      this._installDefaultCallbacksToMqttClient(
        this.globalMqttClient,
        constants.mqtt.brokerUrl,
        this.globalRegistryId,
        constants.globals.NodeType.GLOBAL_REGISTRY
      );

      this.globalMqttClient.registerAndDiscover();
      this.connectedRegistries.add(this.globalRegistryId);

      const that = this;
      setTimeout(() => {
        that.globalMqttClient.disconnect();
        that.globalMqttClient = undefined;
        this.connectedRegistries.delete(this.globalRegistryId);
      }, timeout);
    }
  };

/**
 * Upon receipt of an attribute removal event, pass it onto the rest of the application if it
 * is something we don't already know
 */
Registrar.prototype._respondToAttrRemovalEvent = function (
  self,
  attr,
  event,
  nodeId
) {
  if (
    self.eliminateDuplicates &&
    (!self.discoveries.hasOwnProperty(attr) ||
      !self.discoveries[attr].hasOwnProperty(nodeId))
  ) {
    return;
  }
  delete self.discoveries[attr][nodeId];
  self.emit(event, nodeId);
};

//==============================================================================
// Add and discover attributes
//==============================================================================

/**
 * Add custom, discoverable attributes to this node
 * attrs is an object of key value pairs
 */
Registrar.prototype.addAttributes = function (
  attrs,
  override,
  mqttClient = this.localMqttClient,
  overrideMachType = undefined,
  overrideId = undefined
) {
  // error handling
  if (!override) {
    this._checkFormOfAttrsToAdd(attrs);
  }
  // use the time corresponding to the publication of these attributes as the message ID
  const dedupeId = Date.now();
  // add the attributes on each protocol
  if (mqttClient) {
    mqttClient.addAttributes(attrs, dedupeId, overrideMachType, overrideId);
  }
};

Registrar.prototype.removeAttributes = function (
  attrs,
  mqttClient = this.localMqttClient,
  overrideMachType = undefined,
  overrideId = undefined
) {
  // error handling
  attrs = this._reformatAttrsToRemove(attrs);
  // remove the attributes on each protocol
  if (mqttClient) {
    mqttClient.removeAttributes(attrs, overrideMachType, overrideId);
  }
};

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
Registrar.prototype.discoverAttributes = function (
  dattrs,
  mqttClient = this.localMqttClient
) {
  dattrs = this._checkAndReformatAttrsToDiscover(dattrs);
  if (mqttClient) {
    mqttClient.discoverAttributes(dattrs);
  }
};

Registrar.prototype.stopDiscoveringAttributes = function (
  dattrs,
  mqttClient = this.localMqttClient
) {
  dattrs = this._checkAndReformatAttrsToStopDiscovering(dattrs);
  if (mqttClient) {
    mqttClient.stopDiscoveringAttributes(dattrs);
  }
};

//==============================================================================
// Helpers
//==============================================================================

Registrar.prototype._installDefaultCallbacksToMqttClient = function (
  mqttClient,
  mqttClientUrl,
  mqttClientId,
  clientType
) {
  let self = this;

  if (mqttClient) {
    mqttClient.on("sub-error", function (dattrs) {
      setTimeout(
        mqttClient.subscribe,
        constants.mqtt.longRetryInterval,
        mqttClient,
        dattrs
      );
    });

    mqttClient.on("subs-denied", function (dattrs) {
      var err = new Error("MQTT subscriptions denied");
      err.name = "permissions_err";
      err.value = dattrs;
      self.emit("error", err);
    });

    mqttClient.on("unsub-error", function (dattrs) {
      setTimeout(
        mqttClient.unsubscribe,
        constants.mqtt.longRetryInterval,
        mqttClient,
        dattrs
      );
    });

    mqttClient.on(
      "pub-error",
      function (attr, value, overrideMachType, overrideId) {
        setTimeout(
          mqttClient.publish,
          constants.mqtt.longRetryInterval,
          mqttClient,
          attr,
          value,
          Date.now(),
          overrideMachType,
          overrideId
        );
      }
    );

    mqttClient.on("unpub-error", function (attr, overrideMachType, overrideId) {
      setTimeout(
        mqttClient.unpublish,
        constants.mqtt.longRetryInterval,
        mqttClient,
        attr,
        overrideMachType,
        overrideId
      );
    });

    mqttClient.on(
      "discovery",
      function (attr, event, machType, nodeId, value, dedupeId) {
        self._respondToDiscoveryEvent(
          self,
          attr,
          event,
          machType,
          nodeId,
          value,
          dedupeId,
          mqttClientUrl
        );
      }
    );

    mqttClient.on("attr-removed", function (attr, event, nodeId) {
      self._respondToAttrRemovalEvent(self, attr, event, nodeId);
    });

    mqttClient.on("client-offline", function () {
      mqttClient.disconnect();
      if (clientType === constants.globals.NodeType.LOCAL_REGISTRY) {
        self.connectedRegistries.delete(mqttClientId);
        self.localRegistriesMap.delete(mqttClientId);
      } else if (clientType === constants.globals.NodeType.FOG) {
        self.availableFogs.delete(mqttClientId);
        self.connectedFogs.delete(mqttClientId);
      }
      self.emit("client-offline", mqttClientId, mqttClientUrl, clientType, {
        localRegistriesMap: self.localRegistriesMap,
        availableFogs: self.availableFogs,
      });
    });
  }
};

/**
 * Checks the format of a set of attributes to discover, and reformats them into the form accepted
 * by the three registries
 */
Registrar.prototype._checkAndReformatAttrsToDiscover = function (attrs) {
  // error handling
  if (typeof attrs !== "object") {
    throw new Error(
      "you must specify the attributes you want discovered as an object - see the docs"
    );
  }
  // check that the attrs parameter is properly formed
  var formedAttrs;
  if (
    attrs.all === undefined &&
    attrs.device === undefined &&
    attrs.fog === undefined &&
    attrs.cloud === undefined &&
    attrs.global_registry === undefined &&
    attrs.local_registry === undefined
  ) {
    this._checkFormOfAttrsToDiscover(attrs);
    formedAttrs = {
      device: {},
      fog: {},
      cloud: {},
      global_registry: {},
      local_registry: {},
    };
    for (var key in attrs) {
      formedAttrs.device[key] = attrs[key];
      formedAttrs.fog[key] = attrs[key];
      formedAttrs.cloud[key] = attrs[key];
      formedAttrs.global_registry[key] = attrs[key];
      formedAttrs.local_registry[key] = attrs[key];
    }
  } else {
    this._checkFormOfAttrsToDiscover(attrs.all);
    this._checkFormOfAttrsToDiscover(attrs.device);
    this._checkFormOfAttrsToDiscover(attrs.fog);
    this._checkFormOfAttrsToDiscover(attrs.cloud);
    this._checkFormOfAttrsToDiscover(attrs.global_registry);
    this._checkFormOfAttrsToDiscover(attrs.local_registry);
    for (var key in attrs.all) {
      attrs.device[key] = attrs.all[key];
      attrs.fog[key] = attrs.all[key];
      attrs.cloud[key] = attrs.all[key];
      attrs.global_registry[key] = attrs.all[key];
      attrs.local_registry[key] = attrs.all[key];
    }
    formedAttrs = attrs;
  }
  return formedAttrs;
};

Registrar.prototype._checkAndReformatAttrsToStopDiscovering = function (
  dattrs
) {
  // error handling
  if (!(dattrs instanceof Object) && !(dattrs instanceof Array)) {
    throw new Error(
      "you must specify the attributes to stop discovering in an object or array - see the docs"
    );
  }

  // check that the attrs parameter is properly formed
  var formedDattrs;
  if (dattrs instanceof Array) {
    formedDattrs = {
      device: [],
      fog: [],
      cloud: [],
      local_registry: [],
      global_registry: [],
    };
    for (var i = 0; i < dattrs.length; i++) {
      if (typeof dattrs[i] != "string") {
        throw new Error("the attribute '" + dattrs[i] + "' is not a string");
      }
      formedDattrs.device.push(dattrs[i]);
      formedDattrs.fog.push(dattrs[i]);
      formedDattrs.cloud.push(dattrs[i]);
      formedDattrs.local_registry.push(dattrs[i]);
      formedDattrs.global_registry.push(dattrs[i]);
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
    if (dattrs.local_registry) {
      this._checkArrayOfStrings(dattrs.local_registry);
    }
    if (dattrs.global_registry) {
      this._checkArrayOfStrings(dattrs.global_registry);
    }
    if (dattrs.all) {
      for (var i = 0; i < dattrs.all.length; i++) {
        dattrs.device.push(dattrs.all[i]);
        dattrs.fog.push(dattrs.all[i]);
        dattrs.cloud.push(dattrs.all[i]);
        dattrs.local_registry.push(dattrs.all[i]);
        dattrs.global_registry.push(dattrs.all[i]);
      }
    }
    formedDattrs = dattrs;
  }
  return formedDattrs;
};

Registrar.prototype._checkArrayOfStrings = function (arr) {
  if (!(arr instanceof Array)) {
    throw new Error(
      "attributes to stop discovering must be passed as an array of strings"
    );
  }

  for (var i = 0; i < arr.length; i++) {
    if (typeof arr[i] != "string") {
      throw new Error("the attribute '" + arr[i] + "' is not a string");
    }
  }
};

/**
 * A helper for Registrar.prototype.discoverAttributes;
 * ensures that attrs is an object of <string, string> pairs
 */
Registrar.prototype._checkFormOfAttrsToDiscover = function (attrs) {
  for (var key in attrs) {
    if (key == "status") {
      // ensure that online and offline events are specified
      if (!attrs.status instanceof Object) {
        throw new Error(
          "discovery of the status attribute requires 'online' and 'offline' event names, passed in an object - see the docs"
        );
      }

      // online
      if (!attrs.status.hasOwnProperty("online")) {
        throw new Error(
          "'online' event required for discovery of status attribute"
        );
      } else {
        if (typeof attrs.status.online != "string") {
          throw new Error(
            "the event name '" + attrs.status.online + "' must be a string"
          );
        }
      }

      // offline
      if (!attrs.status.hasOwnProperty("offline")) {
        throw new Error(
          "'offline' event required for discovery of status attribute"
        );
      } else {
        if (typeof attrs.status.offline != "string") {
          throw new Error(
            "the event name '" + attrs.status.offline + "' must be a string"
          );
        }
      }
    } else {
      // ensure that onAdd and onRemove events are specified
      if (!attrs[key] instanceof Object) {
        throw new Error(
          "discovery of an attribute requires 'onAdd' and 'onRemove' event names, passed in an object - see the docs"
        );
      }

      // onAdd
      if (!attrs[key].hasOwnProperty("onAdd")) {
        throw new Error("'onAdd' event required for discovery of an attribute");
      } else {
        if (typeof attrs[key].onAdd != "string") {
          throw new Error(
            "the event name '" + attrs[key].onAdd + "' must be a string"
          );
        }
      }

      // onRemove
      if (!attrs[key].hasOwnProperty("onRemove")) {
        throw new Error(
          "'onRemove' event required for discovery of an attribute"
        );
      } else {
        if (typeof attrs[key].onRemove != "string") {
          throw new Error(
            "the event name '" + attrs[key].onRemove + "' must be a string"
          );
        }
      }
    }
  }
};

Registrar.prototype._checkFormOfAttrsToAdd = function (attrs) {
  if (typeof attrs !== "object") {
    throw new Error("attrs must be an object");
  }
  for (var i = 0; i < this.reservedAttrs.length; i++) {
    if (attrs[this.reservedAttrs[i]] !== undefined) {
      throw new Error(
        "the attribute '" + this.reservedAttrs[i] + "' is reserved"
      );
    }
  }
  for (var attr in attrs) {
    if (attrs[attr] === "") {
      throw new Error(
        "the attribute " +
          attr +
          " has an empty string as its value - this is not permitted"
      );
    }
  }
};

Registrar.prototype._reformatAttrsToRemove = function (attrs) {
  if (typeof attrs == "string") {
    attrs = [attrs];
  } else if (!(attrs instanceof Array)) {
    throw new Error("attrs must be a string or an array of strings");
  }

  for (var i = 0; i < attrs.length; i++) {
    if (typeof attrs[i] != "string") {
      throw new Error("attrs must be a string or an array of strings");
    } else if (attrs[i] == "status") {
      throw new Error("the 'status' attribute cannot be removed");
    }
  }

  return attrs;
};

/**
 * Upon receipt of a discovery event, pass it onto the rest of the application if it is not a duplicate
 */
Registrar.prototype._respondToDiscoveryEvent = function (
  self,
  attr,
  event,
  machType,
  nodeId,
  value,
  dedupeId,
  mqttClientUrl
) {
  if (
    self.eliminateDuplicates &&
    self._isDuplicate(self, attr, nodeId, dedupeId)
  ) {
    return;
  }
  self._updateDiscoveries(self, attr, nodeId, dedupeId);

  // Default handling logic to certain events based on the node type.
  if (
    self.machType === constants.globals.NodeType.CLOUD ||
    self.machType === constants.globals.NodeType.GLOBAL_REGISTRY
  ) {
    if (event === "local-registry-up") {
      self.localRegistriesMap.set(nodeId, {
        url: getUrlFromIpAndPort(value["ip"], value["port"]),
        mqttClient: undefined,
        timestamp: value["timestamp"],
      });
    } else if (event === "local-registry-down") {
      self.localRegistriesMap.delete(nodeId);
    }
  } else if (self.machType === constants.globals.NodeType.LOCAL_REGISTRY) {
    if (mqttClientUrl === constants.mqtt.brokerUrl) {
      // Re-publish everything received from the global MQTT broker.
      self.addAttributes(
        {
          [attr]: value,
        },
        true,
        this.localMqttClient,
        machType,
        nodeId
      );
    } else {
      // This is our own local broker. Listens to connected fogs and devices.
      if (event === "fog-up") {
        this.connectedFogsAndDevices.get("fog").set(nodeId, value);
      } else if (event === "fog-down") {
        this.connectedFogsAndDevices.get("fog").delete(nodeId);
      } else if (event === "device-up") {
        this.connectedFogsAndDevices.get("device").set(nodeId, value);
      } else if (event === "device-down") {
        this.connectedFogsAndDevices.get("device").delete(nodeId);
      }
    }
  } else if (self.machType === constants.globals.NodeType.FOG) {
    if (event === "local-registry-up") {
      if (this.localRegistriesMap.has(nodeId)) {
        if (
          this.localRegistriesMap.get(nodeId)["timestamp"] <= value["timestamp"]
        ) {
          this.localRegistriesMap.set(nodeId, {
            url: getUrlFromIpAndPort(value["ip"], value["port"]),
            mqttClient: undefined,
            timestamp: value["timestamp"],
          });
        }
      } else {
        this.localRegistriesMap.set(nodeId, {
          url: getUrlFromIpAndPort(value["ip"], value["port"]),
          mqttClient: undefined,
          timestamp: value["timestamp"],
        });
      }
    } else if (event === "local-registry-down") {
      this.localRegistriesMap.delete(nodeId);
    }
  } else if (self.machType === constants.globals.NodeType.DEVICE) {
    if (event === "local-registry-up") {
      if (this.localRegistriesMap.has(nodeId)) {
        if (
          this.localRegistriesMap.get(nodeId)["timestamp"] <= value["timestamp"]
        ) {
          this.localRegistriesMap.set(nodeId, {
            url: getUrlFromIpAndPort(value["ip"], value["port"]),
            mqttClient: undefined,
            timestamp: value["timestamp"],
          });
        }
      } else {
        this.localRegistriesMap.set(nodeId, {
          url: getUrlFromIpAndPort(value["ip"], value["port"]),
          mqttClient: undefined,
          timestamp: value["timestamp"],
        });
      }
    } else if (event === "local-registry-down") {
      this.localRegistriesMap.delete(nodeId);
    } else if (event === "fog-up") {
      if (this.availableFogs.has(nodeId)) {
        const currElement = this.availableFogs.get(nodeId);
        if (currElement["timestamp"] <= value["timestamp"]) {
          this.availableFogs.set(nodeId, value);
        }
      } else {
        this.availableFogs.set(nodeId, value);
      }
    } else if (event === "fog-down") {
      this.availableFogs.delete(nodeId);
    }
  }

  // Because node offline events end up here instead of in _respondToAttrRemovalEvent, we need to check the attribute
  // and value in order to know what arguments to pass along with the event.
  if (attr === "status" && value === "offline") {
    self.emit(event, nodeId);
  } else {
    self.emit(event, nodeId, value, {
      localRegistriesMap: self.localRegistriesMap,
      availableFogs: self.availableFogs,
    });
  }
};

/**
 * Returns true if a discovery is a duplicate and false otherwise.
 * attr - the attrubute for which a discovery was made
 * nodeId - the ID of the node for which the discovery was made
 * dedupeId - an ID that tells us if this message is a duplicate or not
 */
Registrar.prototype._isDuplicate = function (self, attr, nodeId, dedupeId) {
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
};

Registrar.prototype._updateDiscoveries = function (
  self,
  attr,
  nodeId,
  dedupeId
) {
  if (!self.discoveries.hasOwnProperty(attr)) {
    self.discoveries[attr] = {};
  }
  self.discoveries[attr][nodeId] = dedupeId;
};

/* exports */
module.exports = Registrar;
