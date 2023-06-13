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
const fogElevationThreshold = 0;
// How few local registries do we need before we use multicast to search network for local registries.
const multicastSearchThreshold = 0;
// How many fogs do we want to be connected to
const targetConnectedFogs = 3;

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

    this.reggie.on("fog-up", (nodeId,value) => that._fogUp(nodeId,value));
    this.reggie.on("fog-down", (nodeId) => that._fogDown(nodeId));


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


  /**********************************************************
   * HANDLERS FOR TRACKING NETWORK ENTITIY DISCOVERY EVENTS *
   **********************************************************/
    
  _localRegistryUp(nodeId, value) {
    this.availableLocalRegistries.set(nodeId, this._createMapEntry(value));
    this.localRegistryMapChange();
  }

  _localRegistryDown(nodeId) {
    this.availableLocalRegistries.delete(nodeId);
    this.connectedLocalRegistries.delete(nodeId);
    this.localRegistryMapChange();
  }

  // Policy for Fog Connection
  _fogUp(nodeId, value) {
    this.availableFogs.set(nodeId, this._createMapEntry(value));
    this.fogMapChange();
  }

  _fogDown(nodeId) {
    this.availableFogs.delete(nodeId);
    this.connectedFogs.delete(nodeId);
    this.fogMapChange();
  }

  /********************
   * POLICY DECISIONS *
   ********************/

  // If we dont receive any new local registry map changes after 0.25 seconds then 
  // we can make decisions on what action to perform. This is necessary as initial 
  // connection to the global registry will dump a lot of information on us.
  // This wait is important so that the device has the most up to date knowledge on 
  // system state.

  startupLocalRegistryMapSettle() {
    const settleTimeout = 0.25;
    if(this.settleTimeoutID) {
      clearTimeout(this.settleTimeoutID);
      this.settleTimeoutID = undefined;
    }
    this.settleTimeoutID = setTimeout(() => {
      console.log("Hopefully local registry map state should have settled down by now!");
      this.settleComplete = true;
      this.localRegistryMapChange();
    }, settleTimeout);
  }

  // Evaluate this whenever there is a change in the local registry map
  localRegistryMapChange() {
    // Wait for local registry map to converge
    if(!this.settleComplete)
    {
      this.startupLocalRegistryMapSettle();
      return;
    }

    if(this.connectedLocalRegistries.size == 0) {
      if(this.availableLocalRegistries.size <= fogElevationThreshold) {
        if(this.reggie.machType == constants.globals.NodeType.FOG) { //TODO: refactor
          if(!this.reggie.hostingLocalRegistry) {
            this.reggie.hostLocalRegistry();
          }
          // If the above condition is not true, we are the only local registry on the network.
        } else if(this.availableLocalRegistries.size == 0) {
          console.log("\nWARNING: There are no Local Registries on the network!\n");
        }
      } else {
        // Just choosing the first node for now.
        for(let entry of this.availableLocalRegistries) {
          // entry[0] is nodeId
          // entry[1] is value

          // For every other node type, jcoreadmin handles connections
          // but for local registries it's the nodecaches responsability.
          if(entry[0] != jsys.id){
            this.reggie.connectToNewLocalRegistry(entry[1].url, entry[0]);
            this.connectedLocalRegistries.add(entry[0]);
            return;
          }
        }
      }  
    }
  }


  fogMapChange() {
    if(jsys.machType !== constants.globals.NodeType.DEVICE) {
      return;
    }
    console.log("FOG MAP CHANGE\n\n\n\n");
    if(this.connectedFogs.size < targetConnectedFogs) {
      for(var nodeId in this.availableFogs.forEach) {
        if(this.connectedFogs.size >= targetConnectedFogs) {
          break;
        }
        // Skip any fogs we are already connected to
        if(this.connectedFogs.has(key)){
          continue;
        }
        // TODO: add location preferencing

        var someImportantDeterminant = true;
        if(someImportantDeterminant) {
          //this.reggie.connectToNewFog()
          this.fuhandler();
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
