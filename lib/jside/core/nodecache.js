"use strict";

/*
 * This module implements the node cache.
 * When a fog or cloud becomes available we put it here. Same way
 * when a fog or cloud goes down. The nodeCache is responsible for
 * selecting the nodes to replace the down ones or the initial ones
 * to connect.
 */
const helper = require("../utils/helper");
const constants = require("../utils/constants");
const udp = require("dgram");
const cbor = require("cbor-x");
const { connect } = require("http2");
const log = require("../utils/jerrlog");

// TODO: These should be user configurable

// How few local registries do we need on the network for us to elevate a fog
const fogElevationThreshold = 1;

// The number of nodes (per mach-type) we want to connect to
const targetConnectedFogs = 5;
const targetConnectedLocalRegistries = 2;

// This is an upper limit to prevent infinite loops (safety precaution)
const MAX_LOOP_ITERS = 200;

// This is arbitrarily chosen at the moment
const reevaluateConnectionLocationDelta = 2_000_000;
//const reevaluateConnectionLocationDelta = 5;


let jsys;

class NodeCache {
    constructor(jamsys) {
	this.appName = jamsys.reggie.app;
	this.location = jamsys.reggie.loc;
	this.machineType = jamsys.reggie.machType;

	this.reggie = jamsys.reggie;

	this.settleTimeoutID = undefined;
	this.settleComplete = false;

	this.availableFogs = new Map();
	this.connectedFogs = new Set();

	this.connectedCloud = undefined;
	
	this.fogMobility = {
	    lastReevaluationLocation: undefined,
	    lastConsiderationThreshold: undefined
	}

	this.neighbourhood = new Set();
	this.neighbourhoodOutOfDate = false;

	this.availableLocalRegistries = new Map();
	this.connectedLocalRegistries = new Set();

	this.localRegistryMobility = {
	    lastReevaluationLocation: undefined,
	    lastConsiderationThreshold: undefined
	}
	
	this.hostedLocalRegistryRequestShutdown = new Set();
	this.hostedLocalRegistryRequestCleanup = new Set();
	this.doingMulticastSearch = false;
	
	this.locationAtLastFogReevaluation = undefined;
	this.locationAtLastLocalRegistryReevaluation = undefined;
	
	jsys = jamsys;
    }

    ////////////////////////////////////////////
    // JCoreAdmin Hook Registration Interface //
    ////////////////////////////////////////////

    onFogUpJCoreAction(handler) {
	this.fuhandler = handler;
    }
    
    onFogDownJCoreAction(handler) {
	this.fdhandler = handler;
    }

    onFogDataUpJCoreAction(handler) {
	this.fduhandler = handler;
    }

    onFogDataDownJCoreAction(handler) {
	this.fddhandler = handler;
    }

    onFogDataUp(handler) {
	this.fduhandler = handler;
    }

    onFogDataDown(handler) {
	this.fddhandler = handler;
    }

    onCloudUpJCoreAction(handler) {
	this.cuhandler = handler;
    }

    onCloudDownJCoreAction(handler) {
	this.cdhandler = handler;
    }

    onCloudDataUpJCoreAction(handler) {
	this.cduhandler = handler;
    }

    onCloudDataDownJCoreAction(handler) {
	this.cddhandler = handler;
    }

    onCustomEvent(eventName, handler) {
	this.reggie.on(eventName, handler);
    }

    ////////////////////
    // Initialization //
    ////////////////////   
    
    init() {
	this.initHooks();

	// Start the final phase of JRegistrar Initialization
	this.reggie.registerAndDiscover();

	let that = this;
	setTimeout(()=>{
	    if(that.availableLocalRegistries.size == 0 &&
               !that.localRegistrySettleComplete) {
		that.localRegistrySettleComplete = true;
		that.localRegistryMapChange();
	    }
	},1000);
    }

    // Register Registrar Hooks.
    initHooks() {
	let that = this;
	this.reggie.on("local-registry-up", (nodeId,value) => {that._localRegistryUp(nodeId, value)});
	this.reggie.on("local-registry-down", (nodeId) => {that._localRegistryDown(nodeId)});

	this.reggie.on("fog-data-up", (nodeId,value) => that._fogDataUp(nodeId,value));
	this.reggie.on("fog-data-down", (nodeId) => that._fogDataDown(nodeId));

	this.reggie.on("cloud-data-up", (nodeId,value) => that._cloudDataUp(nodeId,value));
	this.reggie.on("cloud-data-down", (nodeId) => that._cloudDataDown(nodeId));

	this.reggie.on("local-registry-self-host", () => that.startLocalRegistrySelfHost())
	this.reggie.on("local-registry-alert", (nodeId, value) => that._localRegistryAlert(nodeId, value))

	if(jsys.type == constants.globals.NodeType.DEVICE) {
	    this.reggie.on("fog-up", (nodeId,value) => that._fogUp(nodeId,value));
	    this.reggie.on("fog-down", (nodeId) => that._fogDown(nodeId));
	    this.reggie.on("device-up", (nodeId,value) => that._neighbourhoodDeviceUp(nodeId,value));
	    this.reggie.on("device-down", (nodeId) => that._neighbourhoodDeviceDown(nodeId));
	    this.reggie.on("fog-new-loc", (nodeId, value) => that.fogLocationChange(nodeId,value));

	    // Update neighobourhood attribute 20 times a second
	    this.nieghbourhoodUpdate = setInterval(()=>{that.neighbourhoodUpdateLoop()}, 1000/20);
	} else if (jsys.type == constants.globals.NodeType.FOG) {
	    this.reggie.on("cloud-up", (nodeId,value) => that._cloudUp(nodeId,value));
	    this.reggie.on("cloud-down", (nodeId) => that._cloudDown(nodeId));
	}

	this.reggie.on("client-offline", (nodeId, mqttUrl, machTypes) => that.disconnectHandler(nodeId, mqttUrl, machTypes))
    }
    
    ///////////////////////////////////
    // Local Registry Event Handling //
    ///////////////////////////////////

    _localRegistryUp(nodeId, value) {
	this.availableLocalRegistries.set(nodeId, this.createMapEntry(value));
	this.localRegistryMapChange();
    }

    _localRegistryDown(nodeId) {
	this.availableLocalRegistries.delete(nodeId);

	// Consider adding in a policy where we only remove from connected list if its because
	// of an actual connection failure? Whos likely right, us being actively connected to a node
	// thinking its on.. or an external local registry telling me its off.
	this.connectedLocalRegistries.delete(nodeId);

	this.reggie.disconnectFromLocalRegistry(nodeId);

	this.localRegistryMapChange();
    }

    _localRegistryAlert(nodeId, value) {
	if(value.alertType == "request-to-shutdown") {
	    // A different Local Registry is broadcasting it's intent to shutdown.
	    if(nodeId == jsys.id) {
		return;
	    }

	    this.hostedLocalRegistryRequestShutdown.add(nodeId);

	    // If we are attempting to shutdown extend our timer
	    if(this.localRegistryShutdownTimer) {
		clearTimeout(this.localRegistryShutdownTimer);
		let that = this;
		this.localRegistryShutdownTimer = setTimeout(() => that._shutdownLocalRegistrySelfHostInternal(), 1000);
	    }
	} else if (value.alertType == "revoke-request-to-shutdown") {
	    // A Local Registry that was trying to shutdown is no longer trying to shutdown.
	    
	    if(this.localRegistryShutdownTimer) {
		this.hostedLocalRegistryRequestCleanup.add(nodeId);
	    } else {
		this.hostedLocalRegistryRequestShutdown.delete(nodeId);
	    }
	}
    }

    ///////////////////////////
    // Local Registry Policy //
    ///////////////////////////

    
    // If we dont receive any new local registry map changes after 0.25 seconds then
    // we can make decisions on what action to perform. This is necessary as initial
    // connection to the global registry will dump a lot of information on us.
    // This wait is important so that the device has the most up to date knowledge on
    // system state.

    startupLocalRegistryMapSettle() {
	//const settleTimeout = 0.5;
	if(this.localRegistrySettleTimeoutId) {
	    clearTimeout(this.localRegistrySettleTimeoutId);
	    this.localRegistrySettleTimeoutID = undefined;
	}
	this.localRegistrySettleTimeoutId = setTimeout(() => {
	    log.info("Hopefully local registry map state should have settled down by now!");
	    this.localRegistrySettleComplete = true;
	    log.info(this.availableLocalRegistries);
	    this.localRegistryMapChange();
	}, this.localRegistrySettleTimeout);
    }

    // Run this whenever there is a change in the local registry map (up and down events)
    localRegistryMapChange() {
	
	// Wait for local registry map to converge on initial global registry connection
	if(!this.localRegistrySettleComplete) {
	    this.startupLocalRegistryMapSettle();
	    return;
	}

	// We want to connect to a new local registry.
	if(this.connectedLocalRegistries.size < targetConnectedLocalRegistries) {

	    // Check if we should host a local registry
	    // TODO: This condition should be expanded to include geographically local factors.
	    if(this.reggie.machType == constants.globals.NodeType.FOG) {
		if(this.availableLocalRegistries.size <= fogElevationThreshold &&
		   !this.reggie.hostingLocalRegistry) {
		    this.startLocalRegistrySelfHost();
		}
	    }

	    if(this.availableLocalRegistries.size == 0 && !this.reggie.hostingLocalRegistry) {
		log.warn("\nWARNING: There are no Local Registries listed on the network!\n");
	    }

	    // We haven't found enough local registry advertisements through the standard search
	    if(this.availableLocalRegistries.size < targetConnectedLocalRegistries) {
		if(!this.doingMulticastSearch) {
		    log.info("Doing multicast search for local registries");
		    this.doingMulticastSearch = true;

		    this.searchForLocalRegistryMulticast().then((localRegistryHostInfo) => {
			log.info("\nFound a local registry through multicast\n");

			this.availableLocalRegistries.set(localRegistryHostInfo.id, this.createMapEntry(localRegistryHostInfo));
			this.connectToNewLocalRegistries();
			this.doingMulticastSearch = false;
		    }).catch((err) => {
			log.info("\nCouldn't find any new local registries through multicast.\n");
			this.doingMulticastSearch = false;
		    });
		}
	    }

	    this.connectToNewLocalRegistries();
	}

	if(this.connectedLocalRegistries.size >= targetConnectedLocalRegistries &&
	   this.availableLocalRegistries.size > targetConnectedLocalRegistries &&
	   this.reggie.hostingLocalRegistry) {
            this.shutdownLocalRegistrySelfHost()
	}
    }

    // For now this is quite similar to the fogMapReevaluateConnections code.
    // While in their current state they could be rolled into a generalized handler,
    // I am imagining they will deviate over time.
    localRegistryMapReevaluateConnections() {
	log.info("Re-evaluating our local registry connections.");

	let candidateHead = undefined;

	// Make it harder to disconnect to a local registry than it is to disconnect from a fog?
	const evictionThresholdMultiplier = 1;
	let considerationThreshold = 0;
	let newCandidates = false;
	let numCandidates = 0;

	if(!this.connectedLocalRegistries.size) {
	    this.connectToNewLocalRegistries();
	    return;
	}

	for(let nodeId of this.connectedLocalRegistries) {
	    let localRegistry = this.availableLocalRegistries.get(nodeId);

	    const distance = helper.geo2DistanceLoc(localRegistry.loc, jsys.getLoc());
	    const evictionThreshold = distance * evictionThresholdMultiplier;

	    // The eviction threshold of the farthest node already connected
	    if(considerationThreshold < evictionThreshold) {
		considerationThreshold = evictionThreshold;
	    }

	    let candidateNode = {
		next: candidateHead,
		firstNode: true
	    };

	    while(candidateNode.next &&
		  candidateNode.next.evictionThreshold > evictionThreshold) {
		candidateNode = candidateNode.next;
	    }

	    candidateNode.next = {
		nodeId: nodeId,
		localRegistry: localRegistry,
		distance: distance,
		evictionThreshold: evictionThreshold,
		connected: true,
		next: candidateNode.next
	    };
	    numCandidates++;

	    if(candidateNode.firstNode) {
		candidateHead = candidateNode.next;
	    }
	}

	for(let localRegistryEntry of this.availableLocalRegistries) {
	    let nodeId = localRegistryEntry[0];
	    let localRegistry = localRegistryEntry[1];

	    if(this.connectedLocalRegistries.has(nodeId)) {
		continue;
	    }

	    const trialDistance = helper.geo2DistanceLoc(localRegistry.loc, jsys.getLoc());

	    if(trialDistance < considerationThreshold) {
		newCandidates = true;

		let node = candidateHead;

		while(node.next &&
		      !node.next.firstNode &&
		      node.next.evictionThreshold > trialDistance) {
		    node = node.next;
		}

		node.next = {
		    nodeId: nodeId,
		    localRegistry: localRegistry,
		    distance: trialDistance,
		    evictionThreshold: trialDistance,
		    connected: false,
		    next: node.next
		};

		numCandidates++;
	    }
	}

	this.localRegistryMobility.lastReevaluationLocation = jsys.getLoc();
	this.localRegistryMobility.lastConsiderationThreshold = considerationThreshold;

	// Early exit
	if(!newCandidates) {
	    return;
	}

	let candidateNode = candidateHead;
	let i = numCandidates;

	while(candidateNode) {
	    i--;
	    if(i < targetConnectedLocalRegistries &&
	       !candidateNode.connected) {
		this.reggie.connectToNewLocalRegistry(candidateNode.localRegistry.url, candidateNode.nodeId);
		this.connectedLocalRegistries.add(candidateNode.nodeId);
	    } else if (i >= targetConnectedLocalRegistries &&
                       candidateNode.connected) {
		this.reggie.disconnectFromNode(candidateNode.nodeId);
		this.connectedLocalRegistries.delete(candidateNode.nodeId);
	    }

	    candidateNode = candidateNode.next;
	}
    }

    // Wrapper of our generalized discontinuous selection
    connectToNewLocalRegistries(targetConnections = targetConnectedLocalRegistries) {
	this.connectToNewNodes(this.availableLocalRegistries, this.connectedLocalRegistries, (nodeId) => {
	    let localRegistry = this.availableLocalRegistries.get(nodeId);
	    this.reggie.connectToNewLocalRegistry(localRegistry.url, nodeId);
	    this.connectedLocalRegistries.add(nodeId);
	}, targetConnections);
    }


    ////////////////////////
    // Fog Event Handling //
    ////////////////////////
    
    _fogUp(nodeId, value) {
	log.info("UP: " + nodeId);
	this.availableFogs.set(nodeId, this.createMapEntry(value));
	this.fogMapChange();
    }

    _fogDown(nodeId) {
	this.availableFogs.delete(nodeId);
	this.connectedFogs.delete(nodeId);

	// In the event a fog disconnects during the local registry shutdown protocol.
	this.hostedLocalRegistryRequestShutdown.delete(nodeId);

	this.fdhandler(nodeId);
	this.fogMapChange();
    }

    _fogDataUp(nodeId, value) {
	if(this.availableFogs.has(nodeId)) {
	    this.availableFogs.get(nodeId).redis = value;
	    if(this.connectedFogs.has(nodeId)) {
		this.fduhandler(nodeId, value);
	    }
	}
    }

    _fogDataDown(nodeId) {
	if(this.availableFogs.has(nodeId)) {
	    this.availableFogs.get(nodeId).redis = undefined;
	    if(this.connectedFogs.has(nodeId)) {
		this.fddhandler(nodeId);
	    }
	}
    }

    ////////////////
    // Fog Policy //
    ////////////////

    // This gets called everytime there is a fogDown or fogUp event.
    fogMapChange() {
	if(jsys.type != constants.globals.NodeType.DEVICE) {
	    return;
	}

	if(this.connectedFogs.size < targetConnectedFogs) {
	    this.connectToNewFogs();
	}
    }

    // This is the discontinuous change handler
    connectToNewFogs(targetConnections = targetConnectedFogs) {
	// Using our generalized discontinous change handler
	this.connectToNewNodes(this.availableFogs, this.connectedFogs, (nodeId) => {
	    let fog = this.availableFogs.get(nodeId);

	    this.fuhandler(nodeId, fog);
	    this.connectedFogs.add(nodeId);

	    if(fog.redis != undefined) {
		this.fduhandler(nodeId, fog.redis);
	    }
	}, targetConnections);
    }

    // This is in the event that fog has moved
    fogLocationChange(id, newLoc) {
	    
	// TODO: We should do some very specific checks here instead of doing an entire re-evaluation
	// this is a lazy approach that works for now...
	
	if(helper.geo2DistanceLoc(newLoc, jsys.loc) < this.fogMobility.lastConsiderationThreshold) {
	    this.fogMapReevaluateConnections();
	}

	if(helper.geo2DistanceLoc(newLoc, jsys.loc) < this.localRegistryMobility.lastConsiderationThreshold) {
	    this.localRegistryMapReevaluateConnections();
	}
    }

    // Continuous Change in Fog Location
    fogMapReevaluateConnections() {
	log.info("Re-evaluating our Fog connections.");

	let candidateHead = undefined;

	const evictionThresholdMultiplier = 1;
	let considerationThreshold = 0;
	let newCandidates = false;
	let numCandidates = 0;

	let targetNonLRFogs = targetConnectedFogs;

	if(!this.connectedFogs.size) {
	    return;
	}

	for(let nodeId of this.connectedFogs) {
	    let fog = this.availableFogs.get(nodeId);

	    const distance = helper.geo2DistanceLoc(fog.loc, jsys.getLoc());
	    const evictionThreshold = distance * evictionThresholdMultiplier;

	    if(considerationThreshold < evictionThreshold) {
		considerationThreshold = evictionThreshold;
	    }

	    let candidateNode = {
		next: candidateHead,
		firstNode: true
	    };

	    while(candidateNode.next &&
		  candidateNode.next.evictionThreshold > evictionThreshold) {
		candidateNode = candidateNode.next;
	    }

	    candidateNode.next = {
		nodeId: nodeId,
		fog: fog,
		distance: distance,
		evictionThreshold: evictionThreshold,
		connected: true,
		next: candidateNode.next
	    };
	    numCandidates++;

	    if(candidateNode.firstNode) {
		candidateHead = candidateNode.next;
	    }
	}
	
	for(let fogEntry of this.availableFogs) {
	    let nodeId = fogEntry[0];
	    let fog = fogEntry[1];

	    if(this.connectedFogs.has(nodeId)) {
		continue;
	    }

	    const trialDistance = helper.geo2DistanceLoc(fog.loc, jsys.getLoc());

	    if(trialDistance < considerationThreshold) {
		newCandidates = true;

		let node = candidateHead;

		while(node.next &&
		      !node.next.firstNode &&
		      node.next.evictionThreshold > trialDistance) {
		    node = node.next;
		}

		node.next = {
		    nodeId: nodeId,
		    fog: fog,
		    distance: trialDistance,
		    evictionThreshold: trialDistance,
		    connected: false,
		    next: node.next
		};

		numCandidates++;
	    }
	}

	this.fogMobility.lastReevaluationLocation = jsys.getLoc();
	this.fogMobility.lastConsiderationThreshold = considerationThreshold;

	// Early exit
	if(!newCandidates) {
	    return;
	}

	let candidateNode = candidateHead;
	let i = numCandidates;

	while(candidateNode) {
	    i--;
	    if(i < targetNonLRFogs &&
	       !candidateNode.connected) {
		this.fuhandler(candidateNode.nodeId, candidateNode.fog);
		this.connectedFogs.add(candidateNode.nodeId);

	    } else if (i >= targetNonLRFogs &&
                       candidateNode.connected) {

		this.fdhandler(candidateNode.nodeId);
		this.connectedFogs.delete(candidateNode.nodeId);
	    }
	    candidateNode = candidateNode.next;
	}
    }
    
    //////////////////////////
    // Cloud Event Handling //
    //////////////////////////

    _cloudUp(nodeId, value) {
	if(this.connectedCloud)
	    return;
	
	this.cuhandler(nodeId, value);
	this.connectedCloud = nodeId;
    }

    _cloudDown(nodeId) {
	if(!this.connectedCloud)
	    return;

	this.cdhandler(nodeId);
	this.connectedCloud = undefined;
    }

    _cloudDataUp(nodeId, value) {
	if(nodeId == this.connectedCloud)
	    this.cduhandler(nodeId,value);
    }

    _cloudDataDown(nodeId) {
	if(nodeId == this.connectedCloud) 
	    this.cddhandler(nodeId);
    }

    
    ////////////////////////////
    // Neighbourhood Handling //
    ////////////////////////////

    _neighbourhoodDeviceUp(nodeId, value) {
	this.neighbourhood.add(nodeId);
	this.neighbourhoodOutOfDate = true;
    }

    _neighbourhoodDeviceDown(nodeId) {
	this.neighbourhood.delete(nodeId);
	this.neighbourhoodOutOfDate = true;
    }

    //////////////////////////////////
    // Disconnection Event Handling //
    //////////////////////////////////
    disconnectHandler(nodeId, mqttUrl, machTypes) {
	let was_fog = 0;
	let was_lr = 0;
	for(let machType of machTypes) {
	    if(machType == constants.globals.NodeType.CLOUD) {
		this._cloudDown(nodeId);
	    }
	    if(machType == constants.globals.NodeType.FOG) {
		this._fogDown(nodeId);
		was_fog = 1;
	    }
	    if(machType == constants.globals.NodeType.LOCAL_REGISTRY) {
		this._localRegistryDown(nodeId);
		was_lr = 1;
	    }
	}
    }

    
    /////////////////////////////////
    // Local Registry Self Hosting //
    /////////////////////////////////

    startLocalRegistrySelfHost() {
	if(!this.reggie.hostingLocalRegistry) {
	    this.reggie.hostLocalRegistry();
	    this.connectedLocalRegistries.add(jsys.id);
	    this.listenForLocalRegistrySearchMulticast();
	    this.reggie.debugStatuses({_debug_selfhost: true});
	}
    }

    _shutdownLocalRegistrySelfHostInternal() {
	if(this.hostedLocalRegistryRequestShutdown.size > 1) {
	    let minNodeId = jsys.id;
	    this.hostedLocalRegistryRequestShutdown.forEach((nodeId)=>{
		if(minNodeId > nodeId) {
		    minNodeId = nodeId;
		}
	    });
	    // Only shutdown if we have the lowest nodeid of the group requesting to shutdown.
	    if(minNodeId != jsys.id) {
		// Advertise that we did not proceed with shutting down.
		this.reggie.addAttributes(
		    {
			alerts: {
			    alertType: "revoke-request-to-shutdown"
			}
		    },
		    true,
		    this.reggie.globalMqttClient,
		    constants.globals.NodeType.LOCAL_REGISTRY);

		this.hostedLocalRegistryRequestShutdown.delete(jsys.id);
		this.hostedLocalRegistryRequestCleanup.forEach((nodeId) => {
		    this.hostedLocalRegistryRequestShutdown.delete(nodeId);
		});
		this.hostedLocalRegistryRequestCleanup.clear();

		// Early exit
		this.localRegistryShutdownTimer = undefined;
		return;
	    }

	}

	log.info("###########################################\n Shutting down self-hosted local registry.\n###########################################");

	this.reggie.debugStatuses({_debug_selfhost: false});

	this.connectToNewLocalRegistries(targetConnectedLocalRegistries + 1);
	this.stopListenForLocalRegistrySearchMulticast();
	this.reggie.destroyHostedLocalRegistry();
	this.connectedLocalRegistries.delete(jsys.id);
	this.availableLocalRegistries.delete(jsys.id);

	this.localRegistryShutdownTimer = undefined;
    }

    // To prevent instability in the network we enforce lockstep shutdown of
    // local registries.
    shutdownLocalRegistrySelfHost() {
	if(!this.reggie.hostingLocalRegistry ||
	   this.hostedLocalRegistryRequestShutdown.has(jsys.id)) {
	    return;
	}

	if(this.hostedLocalRegistryRequestShutdown.size == 0) {
	    log.info("Notifying network of shutdown request.");
	    this.reggie.addAttributes(
		{
		alerts: {
		    alertType: "request-to-shutdown"
		}
	    },
		true,
		this.reggie.globalMqttClient,
		constants.globals.NodeType.LOCAL_REGISTRY);
	    
	    this.hostedLocalRegistryRequestShutdown.add(jsys.id);
	    log.info("Attempting to destroy self host now.. "+ this.hostedLocalRegistryRequestShutdown)

	    let that = this;
	    this.localRegistryShutdownTimer = setTimeout(() => that._shutdownLocalRegistrySelfHostInternal(), 500);
	}
    }

    ////////////////////
    // Neighbourhoods //
    ////////////////////

    neighbourhoodUpdateLoop() {
	if(this.neighbourhoodOutOfDate) {
	    this.neighbourhoodOutOfDate = false;
	    for(let fogId of this.connectedFogs) {
		if(!this.reggie.connectedRegistries.has(fogId)) {
		    log.info(this.availableFogs.get(fogId));
		    log.error("ERROR: NodeCache JRegistrar out of sync! "+fogId);
		}

		
		this.reggie.addAttributes(
		    {neighbourhood: this.neighbourhood },
		    true,
		    this.reggie.connectedRegistries.get(fogId).mqttRegistry);
	    }
	}
    }

    //////////////////////////
    // Node Location Change //
    //////////////////////////

    // Our node updated it's location
    nodeUpdateLocation() {
	// Re-evaluate fog map connections if the change in location from our last point we re-evaluated at has changed.
	if(!this.fogMobility.lastReevaluationLocation ||
	   helper.geo2DistanceLoc(this.fogMobility.lastReevaluationLocation, jsys.getLoc()) > reevaluateConnectionLocationDelta) {
            this.fogMapReevaluateConnections();
	}
	

	// For the moment we are using the same minimum location change condition but these are left seperate
	// as we will likely want to make this per-node tunable.
	if(!this.localRegistryMobility.lastReevaluationLocation ||
	   helper.geo2DistanceLoc(this.localRegistryMobility.lastReevaluationLocation, jsys.getLoc()) > reevaluateConnectionLocationDelta) {
            this.localRegistryMapReevaluateConnections();
	}
    }

    /////////////
    // Helpers //
    /////////////

    // first find example of where this change would actually be useful.
    createMapEntry(value) {
	return {
	    url: `mqtt://${value["ip"] || value["host"]}:${value["port"]}`,
	    port: value["port"],
	    ip: value["ip"] || value["host"],
	    loc: value["loc"],
	    redis: undefined,
	    timestamp: value["timestamp"],
	};
    }

    // This is our generalized discontinuous change selector.
    // Used for both local registry and fog selection.
    connectToNewNodes(
	availableNodes,
	connectedNodes,
	connectHandler,
	targetConnections
    ) {
	let candidateHead = undefined;

	let desiredNewConnections = targetConnections - connectedNodes.size;

	let farthestCandidateDistance = Number.MAX_SAFE_INTEGER;

	//let closestDistance = Number.MAX_SAFE_INTEGER;
	// Just choosing the first node for now.
	let nodeId;
	let node;
	for(let entry of availableNodes) {
	    nodeId = entry[0];
	    node = entry[1];

	    if(connectedNodes.size >= targetConnections) {
		break;
	    }
	    if(connectedNodes.has(nodeId)) {
		continue;
	    }
	    if(entry[0] == jsys.id) {
		continue;
	    }

	    const trialDistance = helper.geo2DistanceLoc(node.loc, jsys.getLoc());

	    // This starts greedily adding to the list of new things to connect to.
	    // but then the farthestCanddidateDistance should make this more efficient as time goes on
	    // BUT! worst case is that availableLocalRegistries are listed in descending distance..... SHOULD FIGURE THIS OUT
	    if(trialDistance < farthestCandidateDistance) {
		let parent = undefined;
		let candidateNode = candidateHead;
		let depth = 0;
		let newNode = {
		    distance: trialDistance,
		    nodeId: nodeId,
		    node: node,
		    next: candidateNode
		};

		// Adds an item to our candidateHead list
		// If the item is the farthest but has an index equal to our desired number of new connections
		// then we set that as teh new farthest candidate distance.

		// Preventing risk of infinite loop
		for(let _ = 0; _ < MAX_LOOP_ITERS; _++) {
		    if(candidateNode == undefined ||
		       candidateNode.distance > trialDistance) {
			if(parent) {
			    if(depth == desiredNewConnections-1) {
				farthestCandidateDistance = trialDistance;
			    }
			    parent.next = newNode;
			} else {
			    candidateHead = newNode;
			}
			break;
		    } else {
			depth++;
			candidateNode = candidateNode.next;
		    }
		}
	    }
	}

	let currentNode = candidateHead;
	for(let i = 0; i < desiredNewConnections; i++) {
	    if(currentNode == undefined) {
		return;
	    }
	    // For every other node type, jcoreadmin handles connections
	    // but for local registries it's the nodecaches responsability.
	    connectHandler(nodeId);
	    currentNode = currentNode.next;
	}
    }

    // TODO: make sure this doesn't run in production
    debugStatuses(attribs) {
	this.reggie.setStatuses(
            attribs,
            true,
            this.reggie.localRegistry);
    }

    /////////////////////////
    // Multicast Discovery //
    /////////////////////////
    
    listenForLocalRegistrySearchMulticast(
	groupNumber = 1,
    ) {
	const multicast_addr = constants.multicast.Prefix + "." + groupNumber;
	const port = constants.multicast.Port;

	this.hostedLocalRegistryListener = udp.createSocket({ type: "udp4", reuseAddr: true });
	var listener = this.hostedLocalRegistryListener;

	const sender = udp.createSocket({ type: "udp4", reuseAddr: true });

	listener.bind(port, multicast_addr, function () {
	    listener.addMembership(multicast_addr);
	    listener.setBroadcast(true);
	});

	let that = this;

	listener.on("message", function (msg) {
	    let qmsg = cbor.decode(msg);
	    if (qmsg.cmd !== undefined) {
		switch (qmsg.cmd) {
		case constants.CmdNames.WHERE_IS_LOCAL_REGISTRY:
		    {
			const response = {
			    cmd: constants.CmdNames.HERE_IS_LOCAL_REGISTRY,
			    data: {
				host: jsys.mqtt.server,
				port: jsys.mqtt.port,
				id: jsys.id,
				loc: jsys.reggie.loc
			    }
			};

			log.info(response);

			const encodedResponse = cbor.encode(response);
			if(that.reggie.hostingLocalRegistry) {
			    sender.send(
				encodedResponse,
				0,
				encodedResponse.length,
				port,
				multicast_addr
			    );
			}
			break;
		    }
		}
	    }
	});
    }

    stopListenForLocalRegistrySearchMulticast() {
	this.hostedLocalRegistryListener.close();
    }

    // Send a beacon asking local registries to identify themselves.
    searchForLocalRegistryMulticast(groupNumber = 1, timeout = 1000) {
	const multicast_addr = constants.multicast.Prefix + "." + groupNumber;
	const port = constants.multicast.Port;

	const listener = udp.createSocket({ type: "udp4", reuseAddr: true });
	const sender = udp.createSocket({ type: "udp4", reuseAddr: true });

	listener.bind(port, multicast_addr, function () {
	    listener.addMembership(multicast_addr);
	    listener.setBroadcast(true);
	});

	let that = this;
	return new Promise((resolve, reject) => {
	    const discoveryMessage = {
		cmd: constants.CmdNames.WHERE_IS_LOCAL_REGISTRY,
	    };
	    const encodedDiscoveryMessage = cbor.encode(discoveryMessage);
	    sender.send(
		encodedDiscoveryMessage,
		0,
		encodedDiscoveryMessage.length,
		port,
		multicast_addr
	    );

	    listener.on("message", function (msg) {
		let qmsg = cbor.decode(msg);
		if (qmsg.cmd !== undefined) {
		    switch (qmsg.cmd) {
		    case constants.CmdNames.HERE_IS_LOCAL_REGISTRY:
			if(qmsg.data.id != jsys.id &&
			   !that.availableLocalRegistries.has(qmsg.data.id)) {
			    resolve(qmsg.data);
			}
			break;
		    }
		}
	    });

	    setTimeout(() => {
		reject(`Failed to find local registries in ${timeout}ms.`);
	    }, timeout);
	});
    }
}

module.exports = NodeCache;
