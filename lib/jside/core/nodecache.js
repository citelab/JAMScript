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



//TODO: move this into utility function
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

    this.availableLocalRegistries = new Map();
    this.connectedLocalRegistries = new Set();

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

  onFogDataUp(handler) {
    this.reggie.on("fog-data-up", handler);
  }

  onFogDataDown(handler) {
    this.reggie.on("fog-data-down", handler);
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

    if(jsys.type == constants.globals.NodeType.DEVICE) {
      this.reggie.on("local-registry-connect", (nodeId) => {that._localRegistryNewConnection(nodeId)});
      this.reggie.on("fog-up", (nodeId,value) => that._fogUp(nodeId,value));
      this.reggie.on("fog-down", (nodeId) => that._fogDown(nodeId));
      this.reggie.on("device-up", (nodeId,value) => that._neighbourhoodDeviceUp(nodeId,value));
      this.reggie.on("device-down", (nodeId) => that._neighbourhoodDeviceDown(nodeId));
    }
    
    this.reggie.on("client-offline", (nodeId, mqttUrl, machTypes, registrarState) => that.disconnectHandler(nodeId, mqttUrl, machTypes, registrarState))

    this.reggie.registerAndDiscover();

    //if(!this.reggie.hostingLocalRegistry)
      //this._bootstrappingNodeToFindLocalRegistries();
    
  }

  devChanged() {
    let mdist = 0;
    let mfog = null;
    let mfogId = null;
    const connectedFogsSet = new Set();

    this.reggie.connectedFogs.forEach((rec, k) => {
      let dist = distanceToFog(rec.loc);
      if (dist > mdist) {
        mdist = dist;
        mfog = rec;
        mfogId = k;
      }
      connectedFogsSet.add(k);
    });

    let fogfound = false;
    this.reggie.availableFogs.forEach((rec, k) => {
      if (!connectedFogsSet.has(k)) {
        let dist = distanceToFog(rec.loc);
        if (fogfound === false && dist < mdist) {
          this.reggie.connectToNewFog(k);
          this.reggie.disconnectFromFog(mfogId);
          this.fdhandler(mfogId, mfog);
          this.fuhandler(k, rec);
          fogfound = true;
        }
      }
    });
  }

  
  // INTEGRATION STUFF
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
      mqttClient: undefined,
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

  // Policy for Fog Connection
  _fogUp(nodeId, value) {
    console.log("UP: " + nodeId);
    this.availableFogs.set(nodeId, this._createMapEntry(value));
    this.fogMapChange();
  }

  _fogDown(nodeId) {
    this.availableFogs.delete(nodeId);
    this.connectedFogs.delete(nodeId); //TODO: add settle protection here aswell potentially
    this.fdhandler(nodeId);
    this.fogMapChange();
  }

  

  // Policy for Fog Connection
  _neighbourhoodDeviceUp(nodeId, value) {
    //TODO: add some distance based descriminant
    console.log("new device in neighborhood: " + nodeId);

    this.neighbourhood.add(nodeId);
  }

  _neighbourhoodDeviceDown(nodeId) {
    this.neighbourhood.delete(nodeId);
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

    if(this.connectedLocalRegistries.size <= targetConnectedLocalRegistries) {

      // Check if we should host a local registry
      if(this.reggie.machType == constants.globals.NodeType.FOG) { //TODO: refactor
        if(this.availableLocalRegistries.size <= fogElevationThreshold &&
           !this.reggie.hostingLocalRegistry) {
          this.reggie.hostLocalRegistry();
          this.connectedLocalRegistries.add(jsys.id);
        }
        // If the above condition is not true, we are the only local registry on the network.
      } 
      if(this.availableLocalRegistries.size == 0 && !this.reggie.hostingLocalRegistry) {
        console.log("\nWARNING: There are no Local Registries on the network!\n");
      }


      // Just choosing the first node for now.
      for(let entry of this.availableLocalRegistries) {
        // entry[0] is nodeId
        // entry[1] is value
        
        if(this.connectedLocalRegistries.has(entry[0])){
          continue;
        }
        if(entry[0] == jsys.id){
          continue;
        }

        // For every other node type, jcoreadmin handles connections
        // but for local registries it's the nodecaches responsability.
        this.reggie.connectToNewLocalRegistry(entry[1].url, entry[0]);
        this.connectedLocalRegistries.add(entry[0]);
        
        return;
      }
    }
  }

  // This is an excuse to publish our neighborhood.
  _localRegistryNewConnection(nodeId) {
    let that = this;
    this.reggie.addAttributes(
      {
        neighbourhood: Array.from(that.neighbourhood),
      },
      true,
      this.reggie.connectedRegistries.get(nodeId)
    );
  }

  fogMapChange() {
    if(jsys.type != constants.globals.NodeType.DEVICE) {
      return;
    }

    if(this.connectedFogs.size < targetConnectedFogs) {
      for(var nodeId of this.availableFogs.keys()) {
        if(this.connectedFogs.size >= targetConnectedFogs) {
          break;
        }

        // Skip any fogs we are already connected to
        if(this.connectedFogs.has(nodeId)){
          continue;
        }

        // TODO: add location preferencing
        var someImportantDeterminant = true;
        if(someImportantDeterminant) {
          //this.reggie.connectToNewFog()
          this.fuhandler(nodeId, this.availableFogs.get(nodeId));
          this.connectedFogs.add(nodeId);
        }
      }
    }
  }






  //------------------------------------------------------------------------------
  // Helper Methods
  //------------------------------------------------------------------------------
  getReggie() {
    return this.reggie;
  }


  // This is now @Deprecated!
  _bootstrappingNodeToFindLocalRegistries() {
    console.log("Searching for Local Registries");
    this._discoverLocalRegistry()
      .then((localRegistryHostInfo) => {
        this.reggie.connectToNewLocalRegistry(
          `${localRegistryHostInfo["host"]}:${localRegistryHostInfo["port"]}`,
          localRegistryHostInfo["id"],
          localRegistryHostInfo["loc"]
        );
      })
      .catch((err) => {
        console.log("Couldn't find Local Registries close by, querying Global Registry.");
        this._findLocalRegistriesGlobally(1000)//bootstrapGlobalSearchTimeout)
          .then((localRegistriesMap) => {
            const { localRegistryInfo, localRegistryId } =
              this.onSelectLocalRegistryAtBootstrappingHandler(
                localRegistriesMap,
                this.location
              );
            if(localRegistryId != jsys.id) {
              this.reggie.connectToNewLocalRegistry(
                localRegistryInfo["url"],
                localRegistryId
              );
            } else { // @FIX If there is an onlien record of this node being a local registry, it will start up a registry again.
              console.log("Starting up local registry again.");
              this.reggie.hostLocalRegistry();
            }
            
          })
          .catch((err) => {
            // If we can't find any registries on network
            console.log(err);
            if(this.machineType === constants.globals.NodeType.FOG) {
              console.log("Was unable to find local registries on network. Fog will host new local registry.");
              this.reggie.hostLocalRegistry();
            }
          });
      });
  }

  _respondToLocalRegistryDiscovery(
    groupNumber = 1,
    localRegistryHost,
    localRegistryPort
  ) {
    const multicast_addr = constants.multicast.Prefix + "." + groupNumber;
    const port = constants.multicast.Port;

    const listener = udp.createSocket({ type: "udp4", reuseAddr: true });
    const sender = udp.createSocket({ type: "udp4", reuseAddr: true });

    listener.bind(port, multicast_addr, function () {
      listener.addMembership(multicast_addr);
      listener.setBroadcast(true);
    });

    listener.on("message", function (msg, err) {
      let qmsg = cbor.decode(msg);
      if (qmsg.cmd !== undefined) {
        switch (qmsg.cmd) {
          case constants.CmdNames.WHERE_IS_LOCAL_REGISTRY:
            const response = {
              cmd: constants.CmdNames.HERE_IS_LOCAL_REGISTRY,
              data: {
                host: localRegistryHost,
                port: localRegistryPort,
                id: jsys.id,
                loc: jsys.reggie.loc
              },
            };
            const encodedResponse = cbor.encode(response);
            sender.send(
              encodedResponse,
              0,
              encodedResponse.length,
              port,
              multicast_addr
            );
            break;
        }
      }
    });
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
              resolve(qmsg.data);
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
