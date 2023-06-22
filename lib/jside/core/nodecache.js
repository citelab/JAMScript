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

const bootstrapGlobalSearchTimeout = constants.mqtt.connectionTimeout;


// TODO: make these constants of course

// How few local registries do we need on the network for us to elevate a fog
const fogElevationThreshold = 1;
// How few local registries do we need before we use multicast to search network for local registries.
const multicastSearchThreshold = 0;
// How many fogs do we want to be connected to
const targetConnectedFogs = 3;
const targetConnectedLocalRegistries = 3;

//------------------------------------------------------------------------------
// Module Definition
//------------------------------------------------------------------------------
let jsys;



//TODO: move this into utility file
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

    this.neighbourhood = new Set();
    this.neighbourhoodOutOfDate = false;

    this.availableLocalRegistries = new Map();
    this.connectedLocalRegistries = new Set();

    this.hostedFogRequestToShutdown = new Set();
    this.hostedFogRequestCleanup = new Set();
    this.doingMulticastSearch = false;

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

  onFogDataUp(handler) {
    this.reggie.on("fog-data-up", handler);
  }

  onFogDataDown(handler) {
    this.reggie.on("fog-data-down", handler);
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
    this.reggie.on("local-registry-up", (x) => handler);
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
      //this.reggie.on("local-registry-connect", (nodeId) => {that._localRegistryNewConnection(nodeId)});
      this.reggie.on("fog-up", (nodeId,value) => that._fogUp(nodeId,value));
      this.reggie.on("fog-down", (nodeId) => that._fogDown(nodeId));
      this.reggie.on("device-up", (nodeId,value) => that._neighbourhoodDeviceUp(nodeId,value));
      this.reggie.on("device-down", (nodeId) => that._neighbourhoodDeviceDown(nodeId));

      // 20 Times a second
      this.nieghbourhoodUpdate = setInterval(()=>{that.neighbourhoodUpdateLoop()}, 1000/20);
    }
    
    this.reggie.on("client-offline", (nodeId, mqttUrl, machTypes, registrarState) => that.disconnectHandler(nodeId, mqttUrl, machTypes, registrarState))

    this.reggie.registerAndDiscover();

    setTimeout(()=>{
      if(that.availableLocalRegistries.size == 0 &&
         !that.localRegistrySettleComplete) {
        that.localRegistrySettleComplete = true;
        that.localRegistryMapChange();
      }
    },1000);
  }
  
  getFogData(id) {
    let fog = activefogs.get(id);
    if (fog !== undefined)
        return fog.redis;
    else
        return null;
  }

  fogDataUp(id, info) {
      let fog = activefogs.get(id);
      if (fog !== undefined) {
          fog.redis = info;
          this.fduhandler(id, info);
      } else {
          let fog = otherfogs.get(id);
          if (fog !== undefined) 
              fog.redis = info;
      }
  }

  fogDataDown(id) {
      let fog = activefogs.get(id);
      if (fog !== undefined)
          this.fddhandler(id);
      else {
          let fog = otherfogs.get(id);
          if (fog !== undefined) 
              fog.redis = null;
      }
  }



  /**********************************************************
   * HANDLERS FOR TRACKING NETWORK ENTITIY DISCOVERY EVENTS *
   **********************************************************/
    
  _createMapEntry(value) {
    return {
      url: getUrlFromIpAndPort(value["ip"], value["port"]),
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

  
  _cloudDataUp(nodeId, value) {
    /*if(this.availableFogs.has(nodeId)) {
      this.availableFogs.get(nodeId).redis = value;
      if(this.connectedFogs.has(nodeId)) {
        this.fduhandler(nodeId, value);
      }
    }*/
  }

  _cloudDataDown(nodeId) {
    /*if(this.availableFogs.has(nodeId)) {
      this.availableFogs.get(nodeId).redis = undefined;
      if(this.connectedFogs.has(nodeId)) {
        this.fddhandler(nodeId, value);
      }
    }*/
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

  disconnectHandler(nodeId, mqttUrl, machTypes, registrarState) {
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
    const settleTimeout = 0.25;
    if(this.localRegistrySettleTimeoutId) {
      clearTimeout(this.localRegistrySettleTimeoutId);
      this.localRegistrySettleTimeoutID = undefined;
    }
    this.localRegistrySettleTimeoutId = setTimeout(() => {
      console.log("Hopefully local registry map state should have settled down by now!");
      this.localRegistrySettleComplete = true;
      this.localRegistryMapChange();
    }, this.localRegistrySettleTimeout);
  }

  // Evaluate this whenever there is a change in the local registry map
  localRegistryMapChange() {
    // Wait for local registry map to converge on initial global registry connection
    if(!this.localRegistrySettleComplete)
    {
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
            console.log("Found a local registry through multicast");
  
            this.availableLocalRegistries.set(localRegistryHostInfo.id, this._createMapEntry(localRegistryHostInfo));
            this.doingMulticastSearch = false;
          }).catch((reason) => {
            console.log("Couldn't find any new local registries through multicast.");
            this.doingMulticastSearch = false;
          });
        }
      }

      this.connectToNewLocalRegistry();
    }
    if(this.connectedLocalRegistries.size >= targetConnectedLocalRegistries &&
       this.availableLocalRegistries.size > targetConnectedLocalRegistries &&
       this.reggie.hostingLocalRegistry) {
        this.shutdownLocalRegistrySelfHost();
    }
  }

  // TODO: add more specific requirements for which fogs to connect to.
  connectToNewLocalRegistry(
    targetConnections = targetConnectedLocalRegistries
  ) {

    let bestOption = undefined;
    let closestDistance = Number.MAX_SAFE_INTEGER;
    // Just choosing the first node for now.
    for(let entry of this.availableLocalRegistries) {
      // entry[0] is nodeId
      // entry[1] is value

      if(this.connectedLocalRegistries.size >= targetConnections){
        break;
      }
      
      if(this.connectedLocalRegistries.has(entry[0])){
        continue;
      }
      if(entry[0] == jsys.id){
        continue;
      }
      //entry[1].loc
      const trialDistance = helper.geo2Distance(
        entry[1].loc.long,
        entry[1].loc.lat,
        jsys.long,
        jsys.lat
      );

      if(trialDistance < closestDistance) {
        closestDistance = trialDistance;
        bestOption = {id: entry[0], localRegistry: entry[1]};
      }      
    }

    if(bestOption != undefined) {
      // For every other node type, jcoreadmin handles connections
      // but for local registries it's the nodecaches responsability.
      this.reggie.connectToNewLocalRegistry(bestOption.localRegistry.url, bestOption.id);
      this.connectedLocalRegistries.add(bestOption.localRegistry.id);
    }
  }

  startLocalRegistrySelfHost() {         
    if(!this.reggie.hostingLocalRegistry) {
      this.reggie.hostLocalRegistry();
      this.connectedLocalRegistries.add(jsys.id);
      this._respondToLocalRegistryDiscovery();
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

    this.connectToNewLocalRegistry(targetConnectedLocalRegistries + 1);

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

  // This is an excuse to publish our neighborhood.
  _localRegistryNewConnection(nodeId) {
    let that = this;
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
        //this.reggie.connectToNewFog()
        console.log(JSON.stringify(bestOption))
        this.fuhandler(bestOption.id, bestOption.fog);
        this.connectedFogs.add(bestOption.id);

        if(bestOption.redis != undefined) {
          this.fduhandler(bestOption.id, bestOption.fog.redis);
        }
      }
    }
  }

  neighbourhoodUpdateLoop() {
    if(this.neighbourhoodOutOfDate) {
      this.neighbourhoodOutOfDate = false;
      for(let fogId of this.connectedFogs) {
        this.reggie.addAttributes({
          neighbourhood: this.neighborhood
        },
        true,
        this.reggie.connectedRgistries.get(fogId),
        constants.globals.NodeType.FOG);
      }
    }
  }

  //------------------------------------------------------------------------------
  // Helper Methods
  //------------------------------------------------------------------------------
  
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

    listener.on("message", function (msg, err) {
      let qmsg = cbor.decode(msg);
      if (qmsg.cmd !== undefined) {
        switch (qmsg.cmd) {
          case constants.CmdNames.WHERE_IS_LOCAL_REGISTRY:
            const response = {
              cmd: constants.CmdNames.HERE_IS_LOCAL_REGISTRY,
              data: {
                host: jsys.mqtt.server,
                port: jsys.mqtt.port,
                id: jsys.id,
                loc: jsys.reggie.loc
              },
            };
            const encodedResponse = cbor.encode(response);
            if(that.reggie.hostLocalRegistry) {
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

      listener.on("message", function (msg, err) {
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

function distanceToFog(info) {
  return helper.geo2Distance(jsys.long, jsys.lat, info.long, info.lat);
}

module.exports = NodeCache;
