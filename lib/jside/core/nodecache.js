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

//const bootstrapGlobalSearchTimeout = constants.mqtt.connectionTimeout;


// TODO: move these into constants of course

// How few local registries do we need on the network for us to elevate a fog
const fogElevationThreshold = 1;
// How many fogs do we want to be connected to
const targetConnectedFogs = 5;
const targetConnectedLocalRegistries = 2;

const MAX_LOOP_ITERS = 200;

// This is arbitrary
const reevaluateConnectionLocationDelta = 2_000_000;
//const reevaluateConnectionLocationDelta = 5;

//------------------------------------------------------------------------------
// Module Definition
//------------------------------------------------------------------------------
let jsys;

/*
 * This module implements the node cache.
 */
class NodeCache {
  constructor(jamsys) {
    this.appName = jamsys.reggie.app;
    this.location = jamsys.reggie.loc;
    this.machineType = jamsys.reggie.machType;

    // Setting up the jregistrar.
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

    this.hostedFogRequestToShutdown = new Set();
    this.hostedFogRequestCleanup = new Set();
    this.doingMulticastSearch = false;

    this.locationAtLastFogReevaluation = undefined;
    this.locationAtLastLocalRegistryReevaluation = undefined;

    jsys = jamsys;
  }

  //------------------------------------------------------------------------------
  // APIs(handler functions)
  //------------------------------------------------------------------------------

  // TODO: get rid of almost half of these..
  
  onSelectLocalRegistryAtBootstrapping(handler) {
    this.onSelectLocalRegistryAtBootstrappingHandler = handler;
  }

  onClientError(handler) {
    this.reggie.on("error", handler);
  }

  onConnectedClientDown(handler) {
    this.reggie.on("client-offline", handler);
  }

  onFogUp(handler) {
    this.reggie.on("fog-up", handler);
  }

  onFogUpJCoreAction(handler) {
    this.fuhandler = handler;
  }

  onFogDown(handler) {
    this.reggie.on("fog-down", handler);
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

  onCloudUp(handler) {
    this.reggie.on("cloud-up", handler);
  }

  onCloudUpJCoreAction(handler) {
    this.cuhandler = handler;
  }

  onCloudDown(handler) {
    this.reggie.on("cloud-down", handler);
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

  onLocalRegistryUp(handler) {
    this.reggie.on("local-registry-up", () => handler);
  }

  onLocalRegistryDown(handler) {
    this.reggie.on("local-registry-down", handler);
  }

  onCustomEvent(eventName, handler) {
    this.reggie.on(eventName, handler);
  }

  //------------------------------------------------------------------------------
  // APIs
  //------------------------------------------------------------------------------
  init() {
    //TODO: using lambdas like this is probably absolutely unnecessary...
    let that = this;
    this.reggie.on("local-registry-up", (nodeId,value) => {that._localRegistryUp(nodeId, value)});
    this.reggie.on("local-registry-down", (nodeId) => {that._localRegistryDown(nodeId)});

    this.reggie.on("fog-data-up", (nodeId,value) => that._fogDataUp(nodeId,value));
    this.reggie.on("fog-data-down", (nodeId) => that._fogDataDown(nodeId));

    this.reggie.on("cloud-up", (nodeId,value) => {console.log("Cloud up.... ", nodeId, value)});
    //that._cloudDataUp(nodeId,value));
    this.reggie.on("cloud-down", (nodeId) => that._cloudDataDown(nodeId));

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

      // 20 Times a second
      this.nieghbourhoodUpdate = setInterval(()=>{that.neighbourhoodUpdateLoop()}, 1000/20);
    } else if (jsys.type == constants.globals.NodeType.FOG) {
      this.reggie.on("cloud-up", (nodeId,value) => that._cloudUp(nodeId,value));
      this.reggie.on("cloud-down", (nodeId) => that._cloudDown(nodeId));
    }

    this.reggie.on("client-offline", (nodeId, mqttUrl, machTypes) => that.disconnectHandler(nodeId, mqttUrl, machTypes))

    this.reggie.registerAndDiscover();

    setTimeout(()=>{
      if(that.availableLocalRegistries.size == 0 &&
         !that.localRegistrySettleComplete) {
        that.localRegistrySettleComplete = true;
        that.localRegistryMapChange();
      }
    },1000);
  }

  /**********************************************************
   * HANDLERS FOR TRACKING NETWORK ENTITIY DISCOVERY EVENTS *
   **********************************************************/

  // TODO: put nodeId inside of value.
  _createMapEntry(value) {
    return {
      url: `mqtt://${value["ip"] || value["host"]}:${value["port"]}`,
      port: value["port"],
      ip: value["ip"] || value["host"],
      loc: value["loc"],
      redis: undefined,
      timestamp: value["timestamp"],
    };
  }

  _localRegistryUp(nodeId, value) {
    this.availableLocalRegistries.set(nodeId, this._createMapEntry(value));
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
      if(nodeId == jsys.id) {
        return;
      }
      this.hostedFogRequestToShutdown.add(nodeId);

      if(this.localRegistryShutdownTimer) {
        clearTimeout(this.localRegistryShutdownTimer);
        let that = this;
        this.localRegistryShutdownTimer = setTimeout(() => that._shutdownLocalRegistrySelfHostInternal(), 1000);
      }

    } else if (value.alertType == "revoke-request-to-shutdown") {
      if(this.localRegistryShutdownTimer) {
        this.hostedFogRequestCleanup.add(nodeId);
      } else {
        this.hostedFogRequestToShutdown.delete(nodeId);
      }

    }
  }


  // Policy for Fog Connection
  _fogUp(nodeId, value) {
    console.log("UP: " + nodeId);
    this.availableFogs.set(nodeId, this._createMapEntry(value));
    this.fogMapChange();
  }

  _fogDown(nodeId) {
    this.availableFogs.delete(nodeId);
    this.connectedFogs.delete(nodeId);

    this.hostedFogRequestToShutdown.delete(nodeId);

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

  //@Unimplemented
  _cloudDataUp(nodeId, value) {
    if(nodeId == this.connectedCloud)
      this.cduhandler(nodeId,value);
  }

  //@Unimplemented
  _cloudDataDown(nodeId) {
    if(nodeId == this.connectedCloud) 
      this.cddhandler(nodeId);
  }



  // Policy for Fog Connection
  _neighbourhoodDeviceUp(nodeId, value) {
    this.neighbourhood.add(nodeId);
    this.neighbourhoodOutOfDate = true;
  }

  _neighbourhoodDeviceDown(nodeId) {
    this.neighbourhood.delete(nodeId);
    this.neighbourhoodOutOfDate = true;
  }

  /********************
   * POLICY DECISIONS *
   ********************/

  disconnectHandler(nodeId, mqttUrl, machTypes) {
    let was_fog = 0;
    let was_lr = 0;
    for(let machType of machTypes) {
      if(machType == constants.globals.NodeType.FOG) {
        this._fogDown(nodeId);
	was_fog = 1;
      }
      if(machType == constants.globals.NodeType.LOCAL_REGISTRY) {
        this._localRegistryDown(nodeId);
	was_lr = 1;
      }
    }

    if(!was_fog) {
      if(this.connectedFogs.has(nodeId)) {
	console.log("REALLY BAD:\n\n\n\n\n\n\n\ error for fog");
      }
    }

    
    if(!was_lr) {
      if(this.connectedLocalRegistries.has(nodeId)) {
	console.log("REALLY BAD:\n\n\n\n\n\n\n\ error for lr");
      }
    }
  }

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
      console.log("Hopefully local registry map state should have settled down by now!");
      this.localRegistrySettleComplete = true;
      //console.log(this.availableLocalRegistries);
      this.localRegistryMapChange();
    }, this.localRegistrySettleTimeout);
  }

  // Run this whenever there is a change in the local registry map
  localRegistryMapChange() {
    // Wait for local registry map to converge on initial global registry connection
    if(!this.localRegistrySettleComplete) {
      this.startupLocalRegistryMapSettle();
      return;
    }

    if(this.connectedLocalRegistries.size < targetConnectedLocalRegistries) {

      // Check if we should host a local registry
      if(this.reggie.machType == constants.globals.NodeType.FOG) {
        if(this.availableLocalRegistries.size <= fogElevationThreshold &&
           !this.reggie.hostingLocalRegistry) {
            this.startLocalRegistrySelfHost();
        }
      }

      if(this.availableLocalRegistries.size == 0 && !this.reggie.hostingLocalRegistry) {
        console.log("\nWARNING: There are no Local Registries listed on the network!\n");
      }

      if(this.availableLocalRegistries.size < targetConnectedLocalRegistries) {
        if(!this.doingMulticastSearch) {
          console.log("Doing multicast search for local registries");
          this.doingMulticastSearch = true;

          this._discoverLocalRegistry().then((localRegistryHostInfo) => {
            console.log("\nFound a local registry through multicast\n");

            this.availableLocalRegistries.set(localRegistryHostInfo.id, this._createMapEntry(localRegistryHostInfo));
            this.connectToNewLocalRegistries();
            this.doingMulticastSearch = false;
          }).catch((err) => {
            console.log("\nCouldn't find any new local registries through multicast.\n");
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

  // For now this is quite similar to the fogMapReevaluateConnections code
  // I am imagining they will deviate over time.
  localRegistryMapReevaluateConnections() {
    console.log("Re-evaluating our local registry connections.");

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


  connectToNewFogs(targetConnections = targetConnectedFogs) {
    this.connectToNewNodes(this.availableFogs, this.connectedFogs, (nodeId) => {
      let fog = this.availableFogs.get(nodeId);

      this.fuhandler(nodeId, fog);
      this.connectedFogs.add(nodeId);

      if(fog.redis != undefined) {
        this.fduhandler(nodeId, fog.redis);
      }
    }, targetConnections);
  }

  connectToNewLocalRegistries(targetConnections = targetConnectedLocalRegistries) {
    this.connectToNewNodes(this.availableLocalRegistries, this.connectedLocalRegistries, (nodeId) => {
      let localRegistry = this.availableLocalRegistries.get(nodeId);
      this.reggie.connectToNewLocalRegistry(localRegistry.url, nodeId);
      this.connectedLocalRegistries.add(nodeId);
    }, targetConnections);
  }

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
      //entry[1].loc
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
      //this.reggie.connectToNewLocalRegistry(currentNode.localRegistry.url, currentNode.nodeId);
      //this.connectedLocalRegistries.add(currentNode.nodeId);
      currentNode = currentNode.next;
    }
  }

  startLocalRegistrySelfHost() {
    if(!this.reggie.hostingLocalRegistry) {
      this.reggie.hostLocalRegistry();
      this.connectedLocalRegistries.add(jsys.id);
      this._respondToLocalRegistryDiscovery();
      this.reggie.debugStatuses({_debug_selfhost: true});
    }
  }

  _shutdownLocalRegistrySelfHostInternal() {
    if(this.hostedFogRequestToShutdown.size > 1) {
      let minNodeId = jsys.id;
      this.hostedFogRequestToShutdown.forEach((nodeId)=>{
        if(minNodeId > nodeId) {
          minNodeId = nodeId;
        }
      });

      if(minNodeId != jsys.id) {
        this.reggie.addAttributes({
          alerts: {
            alertType: "revoke-request-to-shutdown"
          }
        },
        true,
        this.reggie.globalMqttClient,
        constants.globals.NodeType.LOCAL_REGISTRY);


        this.hostedFogRequestToShutdown.delete(jsys.id);
        this.hostedFogRequestCleanup.forEach((nodeId) => {
          this.hostedFogRequestToShutdown.delete(nodeId);
        });
        this.hostedFogRequestCleanup.clear();

        // Early exit
        this.localRegistryShutdownTimer = undefined;
        return;
      }

    }

    console.log("###########################################\n Shutting down self-hosted local registry.\n###########################################");

    this.reggie.debugStatuses({_debug_selfhost: false});

    this.connectToNewLocalRegistries(targetConnectedLocalRegistries + 1);

    this.reggie.destroyHostedLocalRegistry();
    this.connectedLocalRegistries.delete(jsys.id);
    this.availableLocalRegistries.delete(jsys.id);

    this.localRegistryShutdownTimer = undefined;
  }

  shutdownLocalRegistrySelfHost() {
    if(!this.reggie.hostingLocalRegistry ||
      this.hostedFogRequestToShutdown.has(jsys.id)) {
      return;
    }

    if(this.hostedFogRequestToShutdown.size == 0) {
      console.log("Notifying network of shutdown request.");
      this.reggie.addAttributes({
        alerts: {
          alertType: "request-to-shutdown"
        }
      },
      true,
      this.reggie.globalMqttClient,
      constants.globals.NodeType.LOCAL_REGISTRY);

      this.hostedFogRequestToShutdown.add(jsys.id);
      console.log("Attempting to destroy self host now.. "+ this.hostedFogRequestToShutdown)

      let that = this;
      this.localRegistryShutdownTimer = setTimeout(() => that._shutdownLocalRegistrySelfHostInternal(), 500);
    }
  }

  fogLocationChange(id, newLoc) {

    // TODO: We should do some very specific checks here instead of doing an entire re-evaluation
    // this is a lazy approach that works for now...

    if(helper.geo2DistanceLoc(newLoc, jsys.loc) < this.fogMobility.lastConsiderationThreshold) {
      //this.fogMapReevaluateConnections();
    }

    if(helper.geo2DistanceLoc(newLoc, jsys.loc) < this.localRegistryMobility.lastConsiderationThreshold) {
      //this.localRegistryMapReevaluateConnections();
    }
  }

  fogMapChange() {
    if(jsys.type != constants.globals.NodeType.DEVICE) {
      return;
    }

    // sync check
//    for()

    if(this.connectedFogs.size < targetConnectedFogs) {
      this.connectToNewFogs();
    }
  }

  fogMapReevaluateConnections() {
    console.log("Re-evaluating our Fog connections.");

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

  neighbourhoodUpdateLoop() {
    if(this.neighbourhoodOutOfDate) {
      this.neighbourhoodOutOfDate = false;
      for(let fogId of this.connectedFogs) {
	// TODO: find the source of the problem here
	if(!this.reggie.connectedRegistries.has(fogId)) {
	  console.log(this.availableFogs.get(fogId));
	  console.log("ERROR: NodeCache JRegistrar out of sync! "+fogId);
	}

	
        this.reggie.addAttributes(
	  {neighbourhood: this.neighbourhood },
	  true,
	  this.reggie.connectedRegistries.get(fogId).mqttRegistry); // TODO: double check that we don't make this mistake in other places.
      }
    }
  }

  // Our node updated it's location
  nodeUpdateLocation() {
    // Bit of a mouthful here.
    // Re-evaluate fog map connections if the change in location from our last point we re-evaluated at has changed.
    if(!this.locationAtLastFogReevaluation ||
      helper.geo2DistanceLoc(this.fogMobility.lastReevaluationLocation, jsys.getLoc()) > reevaluateConnectionLocationDelta) {
        if(this.fogMobility.lastReevaluationLocation)
          console.log(helper.geo2DistanceLoc(this.fogMobility.lastReevaluationLocation, jsys.getLoc()));

        this.fogMapReevaluateConnections();
    }

    if(!this.localRegistryMobility.lastReevaluationLocation ||
       // For now doing the same minimum locaiton delta
      helper.geo2DistanceLoc(this.localRegistryMobility.lastReevaluationLocation, jsys.getLoc()) > reevaluateConnectionLocationDelta) {
        if(this.localRegistryMobility.lastReevaluationLocation)
          console.log(helper.geo2DistanceLoc(this.localRegistryMobility.lastReevaluationLocation, jsys.getLoc()));

        this.localRegistryMapReevaluateConnections();
    }
  }

  //------------------------------------------------------------------------------
  // Helper Methods
  //------------------------------------------------------------------------------


  // TODO: add an option so this doesn't run when we are running prod
    debugStatuses(attribs) {
      this.reggie.setStatuses(
        attribs,
        true,
        this.reggie.localRegistry);
    }

  _respondToLocalRegistryDiscovery(
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

            console.log(response);

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

  _stopRespondToLocalRegistryDiscovery() {
    this.hostedLocalRegistryListener.close();
  }

  _discoverLocalRegistry(groupNumber = 1, timeout = 1000) {
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

  _findLocalRegistriesGlobally(globalSearchTimeout = 10000) {
    /*this.reggie.connectToGlobalRegistryForLocalRegistriesDiscovery(
      globalSearchTimeout
    );*/

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.reggie.localRegistriesMap.size === 0) {
          reject("Unable to find any local registry globally in the given time.");
        } else {
          resolve(this.reggie.localRegistriesMap);
        }
      }, globalSearchTimeout*0.8); // Absolute hack right here
    });
  }

}

module.exports = NodeCache;
