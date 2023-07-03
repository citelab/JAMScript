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

//const bootstrapGlobalSearchTimeout = constants.mqtt.connectionTimeout;


// TODO: move these into constants of course

// How few local registries do we need on the network for us to elevate a fog
const fogElevationThreshold = 1;
// How many fogs do we want to be connected to
const targetConnectedFogs = 4;
const targetConnectedLocalRegistries = 3;

const MAX_LOOP_ITERS = 200;

// This is arbitrary
const reevaluateConnectionLocationDelta = 2_000_000;

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

  onCloudDataUp(handler) {
    this.reggie.on("cloud-data-up", handler);
  }

  onCloudDataDown(handler) {
    this.reggie.on("cloud-data.down", handler);
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

  _createMapEntry(value) {
    return {
      url: `mqtt://${value["ip"]}:${value["port"]}`,
      port: value["port"],
      ip: value["ip"],
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


  //@Unimplemented
  _cloudDataUp(nodeId, value) {
  }

  //@Unimplemented
  _cloudDataDown(nodeId) {
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
    for(let machType of machTypes) {
      if(machType == constants.globals.NodeType.FOG) {
        this._fogDown(nodeId);
      }
      if(machType == constants.globals.NodeType.LOCAL_REGISTRY) {
        this._localRegistryDown(nodeId);
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
          let that = this;
          this._discoverLocalRegistry().then((localRegistryHostInfo) => {
            console.log("Found a local registry through multicast");

            this.availableLocalRegistries.set(localRegistryHostInfo.id, this._createMapEntry(localRegistryHostInfo));
            this.doingMulticastSearch = false;
          }).catch((err) => {
            console.log("Couldn't find any new local registries through multicast.");
            this.doingMulticastSearch = false;
          });
        }
      }

      this.connectToNewLocalRegistries();

    }

    if(this.connectedLocalRegistries.size >= targetConnectedLocalRegistries &&
       this.availableLocalRegistries.size > targetConnectedLocalRegistries &&
       this.reggie.hostingLocalRegistry) {
        //this.shutdownLocalRegistrySelfHost();
    }
  }


  // This is not a general connection evaluation function
  // this is specifically optimzied for sem-continuous movement changes
  // it will only connect to nodes better than what we are already connected to
  // the **MapChange is for processing new connections (discontinuous changes in node map states)
  localRegistryMapReevaluateConnections() {
    console.log("Re-evaluating our local registry connections.");
    let actionCandidates = [];

    // Make it harder to disconnect to a local registry than it is to disconnect from a fog?
    const evictionThresholdMultiplier = 1;
    let considerationThreshold = 0;
    let newCandidates = false;

    for(let nodeId of this.connectedLocalRegistries) {
      let localRegistry = this.availableLocalRegistries.get(nodeId);

      const distance = helper.geo2DistanceLoc(localRegistry.loc, jsys.getLoc());
      const evictionThreshold = distance * evictionThresholdMultiplier;

      // Here we are arbitrarily defining our evictonThreshold multiplier to be 1.2
      if(considerationThreshold < evictionThreshold) {
        considerationThreshold = evictionThreshold;
      }

      actionCandidates.push({
        nodeId: nodeId,
        localRegistry: localRegistry,
        distance: distance,
        evictionThreshold: evictionThreshold,
        connected: true
      });
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
        actionCandidates.push({
          nodeId: nodeId,
          localRegistry: localRegistry,
          evictionThreshold: trialDistance,
          distance: trialDistance,
          connected: false,
        });
      }
    }

    this.localRegistryMobility.lastReevaluationLocation = jsys.getLoc();
    this.localRegistryMobility.lastConsiderationThreshold = considerationThreshold;

    // Early exit to avoid sort if unnecessary
    if(!newCandidates) {
      return;
    }

    // This should be using Timsort internally (merge sort variant)
    actionCandidates = actionCandidates.sort((left,right) => {
      return left.evictionThreshold - right.evictionThreshold;
    });

    for(let i = 0; i < actionCandidates.length; i++) {
      let candidate = actionCandidates[i];
      if(i < targetConnectedLocalRegistries) {
        if(candidate.connected) {
          continue;
        }

        this.reggie.connectToNewLocalRegistry(candidate.localRegistry.url, candidate.nodeId);
        this.connectedLocalRegistries.add(candidate.nodeId);
        //TODO: make this also connect as afog

        if(!this.connectedFogs.has(candidate.nodeId)) {
          if(!this.availableFogs.has(candidate.nodeId)) {
            console.log("Weird state here.. we don't know about this LR being a fog just yet....");
          } else {
            this.fuhandler(candidate.nodeId, this.availableFogs.get(candidate.nodeId));
            this.connectedFogs.add(candidate.nodeId);
          }
        }
      } else {
        if(!candidate.connected) {
          continue;
        }

        this.reggie.disconnectFromNode(candidate.nodeId);
        this.connectedLocalRegistries.delete(candidate.nodeId);

        if(this.connectedFogs.has(candidate.nodeId)) {
          this.fdhandler(candidate.nodeId);
          this.connectedFogs.delete(candidate.nodeId);
        }
      }
    }
  }

  // TODO: add more specific requirements for which fogs to connect to.

  // TODO: Could turn this into a general connection algorithm.
  connectToNewLocalRegistries(
    targetConnections = targetConnectedLocalRegistries
  ) {
    let candidateHead = undefined;

    let desiredNewConnections = targetConnections - this.connectedLocalRegistries.size;

    let farthestCandidateDistance = Number.MAX_SAFE_INTEGER;

    //let closestDistance = Number.MAX_SAFE_INTEGER;
    // Just choosing the first node for now.
    let nodeId;
    let localRegistry;
    for(let entry of this.availableLocalRegistries) {
      nodeId = entry[0];
      localRegistry = entry[1];

      if(this.connectedLocalRegistries.size >= targetConnections) {
        break;
      }
      if(this.connectedLocalRegistries.has(nodeId)) {
        continue;
      }
      if(entry[0] == jsys.id) {
        continue;
      }
      //entry[1].loc
      const trialDistance = helper.geo2DistanceLoc(localRegistry.loc, jsys.getLoc());

      // This starts greedily adding to the list of new things to connect to.
      // but then the farthestCanddidateDistance should make this more efficient as time goes on
      // BUT! worst case is that availableLocalRegistries are listed in descending distance..... SHOULD FIGURE THIS OUT
      if(trialDistance < farthestCandidateDistance) {
        let parent = undefined;
        let node = candidateHead;
        let depth = 0;
        let newNode = {
          distance: trialDistance,
          nodeId: nodeId,
          localRegistry: localRegistry,
          next: node
        };

        // Adds an item to our candidateHead list
        // If the item is the farthest but has an index equal to our desired number of new connections
        // then we set that as teh new farthest candidate distance.

        // Preventing risk of infinite loop
        for(let _ = 0; _ < MAX_LOOP_ITERS; _++) {
          if(node == undefined ||
            node.distance > trialDistance) {
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
            node = node.next;
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

      this.reggie.connectToNewLocalRegistry(currentNode.localRegistry.url, currentNode.nodeId);
      this.connectedLocalRegistries.add(currentNode.nodeId);
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
    //TODO: check if its closer than the farthest chosen fog
    // or if we are a connected fog check if we are farther than our last determination.

    // TODO: We should do some very specific checks here instead of doing an entire re-evaluation
    // this is a lazy approach that works for now...

    this.fogMapReevaluateConnections();
  }


  fogMapChange() {
    if(jsys.type != constants.globals.NodeType.DEVICE) {
      return;
    }

    if(this.connectedFogs.size < targetConnectedFogs) {

      var bestOption = undefined;
      var closestDistance = Number.MAX_SAFE_INTEGER;

      for(var nodeId of this.availableFogs.keys()) {
        if(this.connectedFogs.size >= targetConnectedFogs) {
          break;
        }

        // Skip any fogs we are already connected to
        if(this.connectedFogs.has(nodeId)){
          continue;
        }

        let fog = this.availableFogs.get(nodeId);
        const trialDistance = helper.geo2Distance(
          fog.loc.long,
          fog.loc.lat,
          jsys.long,
          jsys.lat
        );

        if(trialDistance < closestDistance) {
          closestDistance = trialDistance;
          bestOption = {id: nodeId, fog: fog};
        }
      }

      if(bestOption != undefined) {
        //console.log(this.connectedFogs);
        //console.log(this.availableFogs);
        this.fuhandler(bestOption.id, bestOption.fog);
        this.connectedFogs.add(bestOption.id);

        // QUICK HACKY WAY OF DOING MULTIPLE CONNECTIONS
        // could potentially end up infinitely blocking ! TODO: FIX
        if(this.availableFogs.size >= targetConnectedFogs &&
          this.connectedFogs.size < targetConnectedFogs) {
          this.fogMapChange();
        }

        if(bestOption.redis != undefined) {
          this.fduhandler(bestOption.id, bestOption.fog.redis);
        }
      }
    }
  }

  // should this be using a heap
  fogMapReevaluateConnections() {
    console.log("Re-evaluating our fog connections.");
    let actionCandidates = [];

    // Lets just always connect to the closest for now
    const evictionThresholdMultiplier = 1;

    // This is more of a descriminant than anything
    let considerationThreshold = 0;
    let targetNonLRFogs = targetConnectedFogs;

    let newCandidates = false;


    for(let nodeId of this.connectedFogs) {
      if(this.connectedLocalRegistries.has(nodeId)) {
        targetNonLRFogs--;
        continue;
      }

      let fog = this.availableFogs.get(nodeId);

      // maybe avoid this square root...
      const distance = helper.geo2DistanceLoc(fog.loc, jsys.getLoc());
      const evictionThreshold = distance * evictionThresholdMultiplier;
      // Here we are arbitrarily defining our evictionThreshold multiplier to be 1.2
      if(considerationThreshold < evictionThreshold) {
        considerationThreshold = evictionThreshold;
      }

      actionCandidates.push({
        nodeId: nodeId,
        fog: fog,
        distance: distance,
        evictionThreshold: evictionThreshold,
        connected: true
      });
    }

    for(let fogEntry of this.availableFogs) {
      let nodeId = fogEntry[0];
      let fog = fogEntry[1];

      if(this.connectedFogs.has(nodeId)) {
        continue;
      }

      // TODO: get rid of square root
      const trialDistance = helper.geo2DistanceLoc(fog.loc, jsys.getLoc());

      if(trialDistance < considerationThreshold) {
        newCandidates = true;

        actionCandidates.push({
          nodeId: nodeId,
          fog: fog,
          evictionThreshold: trialDistance,
          distance: trialDistance,
          connected: false,
        });
      }
    }

    this.fogMobility.lastReevaluationLocation = jsys.getLoc();
    this.fogMobility.lastConsiderationThreshold = considerationThreshold;

    // early exit to avoid sort if unnecessary
    if(!newCandidates) {
      return;
    }

    // This should be using Timsort internally (merge sort variant)
    actionCandidates = actionCandidates.sort((left,right) => {
      return left.evictionThreshold - right.evictionThreshold;
    });

    for(let i = 0; i < actionCandidates.length; i++) {
      let candidate = actionCandidates[i];

      if(i < targetNonLRFogs) {
        if(candidate.connected) {
          continue;
        }

        this.fuhandler(candidate.nodeId, candidate.fog);
        this.connectedFogs.add(candidate.nodeId);
      } else {
        if(!candidate.connected) {
          continue;
        }

        this.fdhandler(candidate.nodeId);
        this.connectedFogs.delete(candidate.nodeId);
      }
    }
  }


  neighbourhoodUpdateLoop() {
    if(this.neighbourhoodOutOfDate) {
      this.neighbourhoodOutOfDate = false;
      for(let fogId of this.connectedFogs) {
        this.reggie.addAttributes({
          neighbourhood: this.neighbourhood
        },
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


  // TODO: add an option so this doesn't run when we are runnign prod
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
            const encodedResponse = cbor.encode(response);
            if(that.reggie.hostLocal) {
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
