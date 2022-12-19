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

    jsys = jamsys;
  }

  //------------------------------------------------------------------------------
  // APIs(handler functions)
  //------------------------------------------------------------------------------

  onSelectLocalRegistryAtBootstrapping(handler = getTheClosestLocalRegistry) {
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
    this.reggie.on("local-registry-up", handler);
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
    this.reggie.registerAndDiscover();

    if (machType === "device") {
      this._bootstrappingNodeToFindLocalRegistries();
    } else if (machType === "fog") {
      this._bootstrappingNodeToFindLocalRegistries();
      s;
    } else if (machType === "local_registry") {
      this._respondToLocalRegistryDiscovery(
        1,
        localRegistryMqttBrokerIp,
        localRegistryMqttBrokerPort
      );
    }
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

  //------------------------------------------------------------------------------
  // Helper Methods
  //------------------------------------------------------------------------------
  getReggie() {
    return this.reggie;
  }

  _bootstrappingNodeToFindLocalRegistries() {
    this._discoverLocalRegistry()
      .then((localRegistryHostInfo) => {
        this.reggie.connectToNewLocalRegistry(
          `${localRegistryHostInfo["host"]}:${localRegistryHostInfo["port"]}`,
          localRegistryHostInfo["id"]
        );
      })
      .catch((err) => {
        this._findLocalRegistriesGlobally(bootstrapGlobalSearchTimeout)
          .then((localRegistriesMap) => {
            const { localRegistryInfo, localRegistryId } =
              this.onSelectLocalRegistryAtBootstrappingHandler(
                localRegistriesMap
              );
            this.reggie.connectToNewLocalRegistry(
              localRegistryInfo["url"],
              localRegistryId
            );
          })
          .catch((err) => {
            console.log(err);
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
                id: id,
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

  _discoverLocalRegistry(groupNumber = 1, timeout = 10000) {
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
    this.reggie.connectToGlobalRegistryForLocalRegistriesDiscovery(
      globalSearchTimeout
    );

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.reggie.localRegistriesMap.size === 0) {
          reject(
            "Unable to find any local registry globally in the given time."
          );
        } else {
          resolve(this.reggie.localRegistriesMap);
        }
      }, globalSearchTimeout);
    });
  }
}

function distanceToFog(info) {
  return helper.geo2Distance(jsys.long, jsys.lat, info.long, info.lat);
}

module.exports = NodeCache;
