'use strict';
const { assert } = require("console");

var EventEmitter = require("events"),
    globals = require("../utils/constants").globals,
    constants = require("../utils/constants"),
    MQTTRegistry = require("./mqttregistry"),
    os = require("os"),
    log = require("../utils/jerrlog");

/////////////
// Helpers //
/////////////

// Get our current machine's IPv4 Address
function getIPv4Address() {
    var niaddrs = os.networkInterfaces();
    for (var ni in niaddrs) {
	let nielm = niaddrs[ni];
	for (let n in nielm) {
	    if (nielm[n].family === "IPv4" && nielm[n].internal === false)
		return nielm[n].address;
	}
    }
    return globals.localhost;
}

///////////////
// Registrar //
///////////////

// The Registrar is primarily responsible for managing mqtt connections, and tracking network state.
// In the scope of JDiscovery, it sits between the mqttBrokers and the NodeCache

// TODO: clean up this consttructor..
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

    // Wait for JAMCore to initialize that connection
    this.localMqttClient = undefined;

    this.subQos = this.machType == globals.NodeType.DEVICE ? 0 : 1;
    this.pubQos = this.machType == globals.NodeType.DEVICE ? 0 : 1;

    if (config && config.hasOwnProperty("eliminateDuplicates")) {
	this.eliminateDuplicates = config.eliminateDuplicates;
    } else {
	// by default, eliminate duplicates
	this.eliminateDuplicates = false;
    }

    if (config && config.hasOwnProperty("localregistryhost")) {
	this.shouldHostLocalRegistry = config.localregistryhost;
    } else {
	this.shouldHostLocalRegistry = false;
    }

    this.availableRegistries = new Map();
    this.connectedRegistries = new Map();

    this.globalRegistryId = globalRegistryId;

    this.hostingLocalRegistry = false;

    // If the current node is not a cloud nor a global registry,
    // then it must be connected to a local registry to receive info
    // from the cloud.

    this.globalMqttClient = new MQTTRegistry(
	this.app,
	this.machType,
	this.id,
	this.port,
	this.subQos,
	this.pubQos
    );

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

    const that = this;
    if (this.machType == constants.globals.NodeType.FOG) {
	this.discoverAttributes(
	    {
		local_registry: {
		    status: {
			online: "local-registry-up",
			offline: "local-registry-down",
		    },
		},
		cloud: {
		    status: {
			online: "cloud-up",
			offline: "cloud-down"
		    },
		}
	    },
	    this.globalMqttClient
	);
    } else if (this.machType == constants.globals.NodeType.DEVICE) {
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
    } else if (this.machType == constants.globals.NodeType.CLOUD) {
	this.setStatuses(
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
	    this.globalMqttClient
	);
    }
    
    this._installDefaultCallbacksToMqttClient(
	this.globalMqttClient,
	constants.mqtt.brokerUrl,
	this.globalRegistryId,
	constants.globals.NodeType.GLOBAL_REGISTRY
    );
}

/* Registrar inherits from EventEmitter */
Registrar.prototype = Object.create(EventEmitter.prototype);
Registrar.prototype.constructor = Registrar;

// Destructor
Registrar.prototype.close = function() {
    for(let mqtt in this.connectedRegistries) {
	let broker = mqtt[1];
	broker.quit();
    }
    
    this.mqttClient.quit(()=> {
        log.info("------------------------ closed connection -------------");
    });
}

////////////////////
// Initialization //
////////////////////

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
    
    // Early exit to avoid double initialization ()
    if (this.started)
	return;
    
    if(this.localMqttBroker == undefined)
	this.localMqttBroker = this.connectedRegistries.get(this.id);

    // This should never go off
    if (this.localMqttClient.client == undefined) {
	log.warn("WARNING!!! JRegistrar is creating the local broker connection. JAMCore should have already done this.");
	this.localMqttClient.registerAndDiscover(this.localMqttBrokerUrl);
    }

    // Register our advertisement on our own local broker
    const that = this;
    this.setStatuses(
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
	true
    );

    if (this.globalMqttClient &&
	!this.globalMqttClient.client &&
	this.localMqttBrokerUrl !== this.globalMqttClient) {

	// No Last will
	let will = 'none';
	
	// Using the default last will if a cloudf
	if(this.machType == constants.globals.NodeType.CLOUD) {
	    will = undefined;
	}
	
	// Don't include a last will when we connect to the registry... Read only connection
	this.globalMqttClient.registerAndDiscover(constants.mqtt.brokerUrl, will);
    }

    this.started = true;

    // Start Local Registry if prompted to
    if(this.shouldHostLocalRegistry) {
	this.emit("local-registry-self-host");
    }
}

//////////////////////////////////////
// MQTT Broker Connection Interface //
//////////////////////////////////////

// Generalized Broker Connection
// NOTE: cleanup should only be true if we are connecting to our own local broker.
Registrar.prototype.connectToNewMQTTBroker = function (mqttBrokerUrl, nodeId, machType, will=undefined, cleanup=false) {
    if(this.connectedRegistries.has(nodeId)){
	let entry = this.connectedRegistries.get(nodeId);

	// Tracking number of requests to conenct to this broker
	// will only disconnect once all ownership of this broker has been released (through disconnection function).
	entry.connections++;
	return entry.mqttRegistry;
    }
    
    let mqttRegistry = new MQTTRegistry(
	this.app,
	this.machType,
	this.id,
	this.port,
	this.subQos,
	this.pubQos
    );

    this._installDefaultCallbacksToMqttClient(
	mqttRegistry,
	mqttBrokerUrl,
	nodeId,
	machType
    );

    mqttRegistry.registerAndDiscover(mqttBrokerUrl, will, undefined, cleanup);
    this.connectedRegistries.set(nodeId, {
	connections: 1,
	mqttRegistry: mqttRegistry
    });

    this.debugStatuses({_debug_conns: Array.from(this.connectedRegistries.keys())});

    return mqttRegistry;
}

// This is a shallow wrapper over the generalized broker connection function
// the two things it does differently is storing the mqttregistry reference
// and cleaning up the broker on connection (deleting previous statuses)
Registrar.prototype.connectToLocalMQTTBroker = function (mqttBrokerUrl, nodeId, machType, will=undefined) {
    let mqttRegistry = this.connectToNewMQTTBroker(mqttBrokerUrl, nodeId, machType, will, true);
    this.localMqttClient = mqttRegistry;
    return mqttRegistry;
}


/**
 * Connect to a new local registry, given its URL.
 * @param {str} localRegistryUrl
 * @param {str} localRegistryId
 */

// For local registries, the connection process is more involved than a standard node
// 
Registrar.prototype.connectToNewLocalRegistry = function (
    localRegistryUrl,
    localRegistryId,
    localRegistryLoc = undefined
) {
    if (!localRegistryUrl) {
	throw new Error(`The URL of the local registry(${localRegistryId}) to connect to cannot be empty.`);
    }


    if (localRegistryUrl === constants.mqtt.brokerUrl) {
	throw new Error("Cannot connect to the global registry via this API.");
    }


    var mqttRegistry = this.connectToNewMQTTBroker(localRegistryUrl,
						   localRegistryId,
						   constants.globals.NodeType.LOCAL_REGISTRY);

    // Subscribe to JDiscovery Topics
    if (this.machType === globals.NodeType.DEVICE) {
	this.discoverAttributes(
	    {
		fog: {
		    status: {
			online: "fog-up",
			offline: "fog-down",
		    },
		    dataDepot: {
			onAdd: "fog-data-up",
			onRemove: "fog-data-down"
		    },
		    curLoc: {
			onAdd: 'fog-new-loc',
			onRemove: 'fog-loc-removed' // Shouldn't really ever be used for the most part.
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
		// This is only used for neighbourhood discovery
		device: {
		    status: {
			online: "device-up",
			offline: "device-down",
		    },
		},
	    },
	    mqttRegistry
	);
    } else if (this.machType === globals.NodeType.FOG) {
	this.discoverAttributes(
	    {
		cloud: {
		    status: {
			online: "cloud-up",
			offline: "cloud-down",
		    },
		    dataDepot: {
			onAdd: "cloud-data-up",
			onRemove: "cloud-data-down"
		    }
		},
		local_registry: {
		    status: {
			online: "local-registry-up",
			offline: "local-registry-down",
		    },
		    alerts: {
			onAdd: "local-registry-alert",
			onRemove: "NOTHING",  // TODO: this is enforced due to API design of mqttRegistry @FIX
		    }
		},
	    },
	    mqttRegistry
	);
    }

    const that = this;
    this.setStatuses(
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
	mqttRegistry
    );

    log.info(`\n######################################\n Connected To New Local Registry\n ${localRegistryUrl}\n ${localRegistryId}\n######################################\n`);

    this.emit("local-registry-connect", localRegistryId);
};


/////////////////////////////////////////
// MQTT Broker Disconnection Interface //
/////////////////////////////////////////

// This is a shallow wrapper of our generic disconnect for API consistency at the moment...
Registrar.prototype.disconnectFromLocalRegistry = function (nodeId) {
    this.disconnectFromNode(nodeId);
};

Registrar.prototype.disconnectFromNode = function (nodeId) {
    if (this.connectedRegistries.has(nodeId)) {
	let entry = this.connectedRegistries.get(nodeId);
	entry.connections--;
	if(entry.connections == 0) {
	    entry.mqttRegistry.disconnect();
	    this.connectedRegistries.delete(nodeId);
	    this.debugStatuses({_debug_conns: Array.from(this.connectedRegistries.keys())});
	}
    }
};

// TODO: look over this stuff and refactor the function names.

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
    return;
    if (
	self.eliminateDuplicates &&
	    (!self.discoveries.hasOwnProperty(attr) ||
	     !self.discoveries[attr].hasOwnProperty(nodeId))
    ) {
	return;
    }
    // TODO: go through all of this stuff again... I think this should all be changed probably
    //delete self.discoveries[attr][nodeId];
    self.emit(event, nodeId);
};


//////////////////////////////////
// Registry Statuses Interfaces //
//////////////////////////////////

/**
 * Add custom, discoverable attributes to this node
 * attrs is an object of key value pairs
 */
Registrar.prototype.setStatuses = function (
    attrs,
    override,
    mqttClient = this.localMqttClient,
    overrideMachType = undefined,
    overrideId = undefined,
    forcePublish = false
) {
    // error handling
    if (!override) {
	this._checkFormOfAttrsToAdd(attrs);
    }

    // use the time corresponding to the publication of these attributes as the message ID
    const dedupeId = Date.now();
    // add the attributes on each protocol
    if (mqttClient) {
	log.info("Setting Status");
	//console.trace();
	mqttClient.setStatuses(attrs, dedupeId, overrideMachType, overrideId, forcePublish);
    } else {
	log.error("Error: attempt to set status for undefined broker.");
    }
};

Registrar.prototype.removeStatuses = function (
    attrs,
    mqttClient = this.localMqttClient,
    overrideMachType = undefined,
    overrideId = undefined
) {
    // error handling
    attrs = this._reformatAttrsToRemove(attrs);
    // remove the attributes on each protocol
    if (mqttClient) {
	mqttClient.removeStatuses(attrs, overrideMachType, overrideId);
    }
};

Registrar.prototype.debugStatuses = function (attrs) {
    if (this.localMqttClient) {
	this.setStatuses(attrs, false);
    }
}

//////////////////////////////////
// Registry Attribute Interface //
//////////////////////////////////

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

/////////////////////////////////////
// Registry Subscription Interface //
/////////////////////////////////////

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

////////////////////////////////////////////
// Register MQTT Registry Event Listeners //
////////////////////////////////////////////

// This is where we register event handlers for the minimally processed messages coming
// from the mqttregistry objects.

// mqttClient is a mqttRegistry Object
// mqttClientUrl is a string
// mqttCLientId is a string
// clientType is a string (machType enum)
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

	// All jdiscovery related mqtt messages are handled here.
	mqttClient.on(
	    "discovery",
	    function (attr, event, machType, nodeId, value, dedupeId, retain) {
		if (!this.started) {
		    self.respondToDiscoveryEvent(
			self,
			attr,
			event,
			machType,
			nodeId,
			value,
			dedupeId,
			retain,
			mqttClientUrl,
			mqttClientId
		    );
		}
	    }
	);

	mqttClient.on("attr-removed", function (attr, event, nodeId) {
	    self._respondToAttrRemovalEvent(self, attr, event, nodeId);
	});


	// Disconnection handling (through tcp heatbeat ending not jdiscovery)
	mqttClient.on("client-offline", function () {
	    // Kind of messy, but there really isn't any way of knowing the GR
	    // client id before we connect to it realistically
	    if(!mqttClientId) {
		log.info("Global registry offline.");
		return;
	    }
	    
	    log.info("Client went offline " + mqttClientId);

	    if(mqttClientId == self.id) {
		log.error("Disconnected from our own local broker!!");
		return;
	    }

	    // Fix dangling connections
	    // In the event that we receive this disconenction before the last-will offline
	    // status gets processed we forward this offline status to the nodecache
	    if(self.connectedRegistries.has(mqttClientId)) {

		// This is not ideal as this could mask underlying bugs in jdiscovery
		// however in the situation where we have connected to a local registry
		// by multicast and then the network gets partitioned, jregistrar doesn't
		// know about the LR as there is no received advertisement.
		if(!self.availableRegistries.has(mqttClientId)) {
		    return;
		}
		
		// Introspect our advertisement state to see what mach types this node id was registered as
		let machTypes = Object.keys(self.availableRegistries.get(mqttClientId).sourceMap);

		self.emit("client-offline", mqttClientId, mqttClientUrl, machTypes, {
		    availableRegistries: self.availableRegistries,
		    connectedRegistries: self.connectedRegistries
		});
	    }
	});
    }
};


/////////////////////////////////
// Attribute Format Validation //
/////////////////////////////////

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

////////////////////
// Event Handling //
////////////////////

Registrar.prototype.respondToDiscoveryUpEvent = function (
    self,
    nodeId,
    value,
    mqttClientId,
    targetMachType
) {
    // Check for a more up-to-date record for the same registry
    if (this.availableRegistries.has(nodeId)) {
	var registryRecord = this.availableRegistries.get(nodeId);
	if(targetMachType in registryRecord.sourceMap) {
	    // Check if stale message
	    if(registryRecord.sourceMap[targetMachType].timestamp > value.timestamp) {
		return false;
	    }

	    // update our internal status
	    registryRecord.sourceMap[targetMachType].timestamp = value.timestamp;
	    registryRecord.sourceMap[targetMachType].sources.add(mqttClientId);
	} else {
	    // register this node as acting as an additional mach type
	    registryRecord.sourceMap[targetMachType] = {
		timestamp: value.timestamp,
		sources: new Set([mqttClientId])
	    };
	}
    } else {
	// First time seeing this node, initialize our record of advertisement
	self.availableRegistries.set(nodeId, {
	    id: nodeId,
	    url: `${value['ip']}:${value['port']}`,
	    port: value["port"],
	    ip: value["ip"],
	    loc: value["loc"],
	    sourceMap: {
		[targetMachType]: {
		    timestamp: value["timestamp"],
		    sources: new Set([mqttClientId])
		}
	    }
	});
    }

    return true;
}

Registrar.prototype.respondToDiscoveryDownEvent = function (
    self,
    nodeId,
    value,
    mqttClientId, // id of registry we received information from
    targetMachType
) {

    //log.info("Discovery Down Event: "+targetMachType);

    // Check for a more up-to-date record for the same registry
    if (this.availableRegistries.has(nodeId)) {
	var registryRecord = this.availableRegistries.get(nodeId);
	if(targetMachType in registryRecord.sourceMap) {
	    // Check if stale message
	    if(registryRecord.sourceMap[targetMachType].timestamp > value.timestamp) {
		return false;
	    }

	    // Update our internal state
	    registryRecord.sourceMap[targetMachType].timestamp = value.timestamp;
	    registryRecord.sourceMap[targetMachType].sources.delete(mqttClientId);

	    // Only set node mach type as going offline if all connected registries agree on
	    // offline status. Better to be conservative about online statuses as we can get
	    // false offline statuses due to network partitions.
	    if(registryRecord.sourceMap[targetMachType].sources.size == 0) {
		delete registryRecord.sourceMap[targetMachType];
	    } else {
		return false;
	    }

	    // If this node has no online statuses for any mach types we delete our record
	    // of advertisement.
	    if(Object.keys(registryRecord.sourceMap).length == 0) {
		this.availableRegistries.delete(nodeId);
	    }
	}
	return true;
    }

    // Even though we don't know anything about this registry,
    // we still send event through to nodecache. We are only
    // trying to filter for stale messages here.
    return false;
}

// This is the primary jdiscovery message processing function.
Registrar.prototype.respondToDiscoveryEvent = function (
    self,
    attr,
    event,
    machType,
    nodeId,
    value,
    dedupeId,
    retain,
    mqttClientUrl,
    mqttClientId
) {
    // There may be edge cases where we want to be notified about our own state from an
    // external registry. For now excluding all however.
    if(nodeId == self.id){
	return;
    }
    
    var eventType = "";
    var nodeType = undefined;

    // New Generalised Handling (we could extract this all from the event name...)
    // This is event type classification
    if (event == "device-up") {
        eventType = "up";
        nodeType = constants.globals.NodeType.DEVICE;
    } else if (event == "device-down") {
        eventType = "down";
        nodeType = constants.globals.NodeType.DEVICE;
    } else if (event == "fog-up") {
        eventType = "up";
        nodeType = constants.globals.NodeType.FOG;
    } else if (event == "fog-down") {
        eventType = "down";
        nodeType = constants.globals.NodeType.FOG;
    } else if (event == "local-registry-up") {
        eventType = "up";
        nodeType = constants.globals.NodeType.LOCAL_REGISTRY;
    } else if (event == "local-registry-down") {
        eventType = "down";
        nodeType = constants.globals.NodeType.LOCAL_REGISTRY;
    } else if (event == "cloud-up") {
        eventType = "up";
        nodeType = constants.globals.NodeType.CLOUD;
    } else if (event == "cloud-down") {
        eventType = "down";
        nodeType = constants.globals.NodeType.CLOUD;
    } else if (event == "fog-data-up") {
		//console.log("~~~~~~~~~~~ fog data up ...", nodeId);
        eventType = "data-up";
    } else if (event == "fog-data-down") {
        eventType = "data-down";
    } else if (event == "cloud-data-up") {
        eventType = "data-up";
    } else if (event == "cloud-data-down") {
        eventType = "data-down";
    } else if (event == "local-registry-alert") {
        eventType = "alert";
    }

    var success = undefined;

    // Store message state if valid
    if(eventType == "up") {
	success = this.respondToDiscoveryUpEvent(self, nodeId, value, mqttClientId, nodeType);
    } else if(eventType == "down") {
	success = this.respondToDiscoveryDownEvent(self, nodeId, value, mqttClientId, nodeType);
    } else if(eventType == "") {
	log.error("ERROR: Unknown Discovery Event: "+ event);
	return;
    }

    // If unsuccesfull, it means we received a stale message and the system is already more up to date.
    // Not propogating stale messages.
    if(success === false) {
	return;
    }

    // If we are hosting a local registry, re-publish all discovery statuses from global registry.
    if (this.hostingLocalRegistry) {
	if (mqttClientUrl === constants.mqtt.brokerUrl) {
	    if (retain) {
		self.setStatuses(
		    {
			[attr]: value,
		    },
		    true,
		    this.localMqttClient,
		    machType,
		    nodeId
		);
	    } else {
		self.addAttributes(
		    {
			[attr]: value,
		    },
		    true,
		    this.localMqttClient,
		    machType,
		    nodeId
		);
	    }
	}
    }

    // Because node offline events end up here instead of in _respondToAttrRemovalEvent, we need to check the attribute
    // and value in order to know what arguments to pass along with the event.
    if (attr === "status" && value === "offline") {
	self.emit(event, nodeId);
    } else {
	self.emit(event, nodeId, value);
    }
};


 /////////////////////////////////
 // Self-Hosting Local Registry //
 /////////////////////////////////

const HOSTED_LOCAL_REGISTRY_GLOBAL_ATTRIBUTES = {
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
	alerts: {
	    onAdd: "local-registry-alert",
	    onRemove: "NOTHING"
	}
    },
}

const HOSTED_LOCAL_REGISTRY_LOCAL_ATTRIBUTES ={
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
    }
};


Registrar.prototype.hostLocalRegistry = function () {
    if (this.machType !== globals.NodeType.FOG) {
	log.error("ERROR: Cannot host a local registry unless node is a fog! (attempt to host)");
	return;
    }

    if(this.hostingLocalRegistry) {
	log.error("ERROR: Cannot host a local registry while already hosting one!");
	return;
    }

    // Attempting to disconnect before we are even connected..
    if(this.globalMqttClient.client) {
	this.globalMqttClient.restartConnection(undefined, constants.globals.NodeType.LOCAL_REGISTRY);
    }

    // This attribute configuration is done regardless of pre-existing state of global connection
    // which is done because this configuration specific to local registries.

    // Subscribe to the following attributes
    // on the global MQTT broker.
    this.discoverAttributes(
	HOSTED_LOCAL_REGISTRY_GLOBAL_ATTRIBUTES,
	this.globalMqttClient
    );

    // Subscribe to `fog` and `device` on
    // its own MQTT broker.
    this.discoverAttributes(
	HOSTED_LOCAL_REGISTRY_LOCAL_ATTRIBUTES,
	this.localMqttClient
    );

    const that = this;

    let onlineStatus = {
	status: function () {
	    return {
		port: that.port,
		ip: getIPv4Address(),
		loc: that.loc,
		timestamp: Date.now(),
	    };
	},
    };

    this.setStatuses(
	onlineStatus,
	true,
	that.globalMqttClient,
	constants.globals.NodeType.LOCAL_REGISTRY
    );

    // Publish locally as-well in case we don't have a good connection to global Registry
    this.setStatuses(
	onlineStatus,
	true,
	that.mqttClient,
	constants.globals.NodeType.LOCAL_REGISTRY
    );

    // Register ourself on our own Local Registry
    this.setStatuses(
	onlineStatus,
	true,
	that.mqttClient,
	constants.globals.NodeType.FOG
    );

    /*
      this._installDefaultCallbacksToMqttClient(
      this.globalMqttClient,
      constants.mqtt.brokerUrl,
      this.globalRegistryId,
      constants.globals.NodeType.GLOBAL_REGISTRY
      );*/


    this.hostingLocalRegistry = true;
    log.info("\n################################\n Fog Now Hosting Local Registry \n################################\n");
}

Registrar.prototype.destroyHostedLocalRegistry = function (options) {
    if (this.machType !== globals.NodeType.FOG) {
	log.error("ERROR: Cannot host a local registry unless node is a fog! (attempt to shutdown)");
	return;
    }
    if (!this.hostingLocalRegistry) {
	log.error("ERROR: Cannot shutdown local registry if no local registry is running.")
	return;
    }

    this.stopDiscoveringAttributes(
	Object.keys(HOSTED_LOCAL_REGISTRY_GLOBAL_ATTRIBUTES),
	this.globalMqttClient
    );

    this.stopDiscoveringAttributes(
	Object.keys(HOSTED_LOCAL_REGISTRY_LOCAL_ATTRIBUTES),
	this.globalMqttClient
    );

    this.setStatuses(
	{ status: "offline" },
	true,
	this.globalMqttClient,
	constants.globals.NodeType.LOCAL_REGISTRY
    );

    // Publish locally as-well in case we don't have a good connection to global Registry
    this.setStatuses(
	{ status: "offline" },
	true,
	this.mqttClient,
	constants.globals.NodeType.LOCAL_REGISTRY
    );

    this.hostingLocalRegistry = false;
}

/* exports */
module.exports = Registrar;
