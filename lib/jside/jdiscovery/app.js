console.log("asdasd");
const Registrar = require("./jregistrar");
console.log("asdasd");
const { Random, MersenneTwister19937 } = require("random-js");
const constants = require("../utils/constants");
console.log("asdasd");
const udp = require("dgram");
const cbor = require("cbor-x");
const MQTTRegistry = require("./mqttregistry");
console.log("asdasd");
const random = new Random(MersenneTwister19937.autoSeed());
//------------------------------------------------------------------------------
// Inputs
//------------------------------------------------------------------------------
const app = "keithTest";
const loc = 1000;
const machType = process.argv[2];
const localMqttBrokerPort = process.argv[3];

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
const id =
  machType === constants.globals.NodeType.CLOUD ||
  machType === constants.globals.NodeType.GLOBAL_REGISTRY
    ? constants.mqtt.globalRegistryId
    : random.uuid4();
const deviceLocalMqttBrokerUrl = `mqtt://127.0.0.1:${localMqttBrokerPort}`;
const deviceLocalPort = localMqttBrokerPort;
const fogLocalMqttBrokerUrl = `mqtt://127.0.0.1:${localMqttBrokerPort}`;
const fogLocalPort = localMqttBrokerPort;
const localRegistryMqttBrokerUrl = fogLocalMqttBrokerUrl;
const localRegistryMqttBrokerIp = "mqtt://127.0.0.1";
const localRegistryMqttBrokerPort = localMqttBrokerPort;
const globalRegistryMqttBrokerPort = "18830";
const globalRegistryId = constants.mqtt.globalRegistryId;
const bootstrapGlobalSearchTimeout = 10000;

const policyOnConnectedLocalRegistriesDown = function (localRegistriesMap) {
  if (localRegistriesMap.size === 0) {
    bootstrappingNodeToFindLocalRegistries();
  } else {
    const { localRegistryInfo, localRegistryId } =
      findARandomLocalRegistry(localRegistriesMap);
    reggie.connectToNewLocalRegistry(localRegistryInfo["url"], localRegistryId);
  }
};

const policyOnConnectedFogDown = function (availableFogs) {
  if (availableFogs.size !== 0) {
    const { fogId } = findARandomFog(availableFogs);
    reggie.connectToNewFog(fogId);
  }
};

console.log("_______________________________________________");
console.log(machType + " id: " + id);
console.log("-----------------------------------------------");
console.log();

let reggie;

//------------------------------------------------------------------------------
// Helper methods
//------------------------------------------------------------------------------
const findARandomLocalRegistry = function (localRegistriesMap) {
  let result;
  localRegistriesMap.forEach((value, key) => {
    result = {
      localRegistryInfo: value,
      localRegistryId: key,
    };
  });
  return result;
};

const findARandomFog = function (availableFogs) {
  let result;
  availableFogs.forEach((value, key) => {
    result = {
      fogInfo: value,
      fogId: key,
    };
  });
  return result;
};

function bootstrappingNodeToFindLocalRegistries() {
  findLocalRegistriesGlobally(bootstrapGlobalSearchTimeout)
  .then((localRegistriesMap) => {
    const { localRegistryInfo, localRegistryId } =
      findARandomLocalRegistry(localRegistriesMap);
      console.log(localRegistryInfo["url"]);
    reggie.connectToNewLocalRegistry(
      localRegistryInfo["url"],
      localRegistryId
    );
  })
  .catch((err) => {
    console.log(err);
  });
}

function bootstrappingNodeToFindLocalRegistries_OVERWRITTEN() {
  discoverLocalRegistry()
    .then((localRegistryHostInfo) => {
      console.log(`TEMP: ${localRegistryHostInfo["host"]}:${localRegistryHostInfo["port"]}`);
      reggie.connectToNewLocalRegistry(
        `${localRegistryHostInfo["host"]}:${localRegistryHostInfo["port"]}`,
        localRegistryHostInfo["id"]
      );
    })
    .catch((err) => {

      console.log(err);
      findLocalRegistriesGlobally(bootstrapGlobalSearchTimeout)
        .then((localRegistriesMap) => {
          const { localRegistryInfo, localRegistryId } =
            findARandomLocalRegistry(localRegistriesMap);
            console.log(localRegistryInfo["url"]);
          reggie.connectToNewLocalRegistry(
            localRegistryInfo["url"],
            localRegistryId
          );
        })
        .catch((err) => {
          console.log(err);
        });
    });
}

function respondToLocalRegistryDiscovery(
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

function discoverLocalRegistry(groupNumber = 1, timeout = 10000) {
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

function findLocalRegistriesGlobally(globalSearchTimeout = 10000) {
  reggie.connectToGlobalRegistryForLocalRegistriesDiscovery(
    globalSearchTimeout
  );

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (reggie.localRegistriesMap.size === 0) {
        reject("Unable to find any local registry globally in the given time.");
      } else {
        resolve(reggie.localRegistriesMap);
      }
    }, globalSearchTimeout);
  });
}

//------------------------------------------------------------------------------
// Default discoveries
//------------------------------------------------------------------------------
if (machType === "device") {
  reggie = new Registrar(
    app,
    machType,
    id,
    deviceLocalPort,
    loc,
    undefined,
    deviceLocalMqttBrokerUrl,
    undefined,
    undefined,
    globalRegistryId
  );

  reggie.on("fog-up", function (fogId, connInfo) {
    console.log(
      "FOG UP: id: " +
        fogId +
        ", ip: " +
        connInfo.ip +
        ", port: " +
        connInfo.port +
        ", loc: " +
        connInfo.loc
    );
    reggie.connectToNewFog(fogId);
  });

  reggie.on("fog-down", function (fogId) {
    console.log("FOG DOWN: id: " + fogId);
  });

  reggie.on(
    "client-offline",
    function (
      nodeId,
      clientUrl,
      clientType,
      { localRegistriesMap, availableFogs }
    ) {
      if (clientType === constants.globals.NodeType.LOCAL_REGISTRY) {
        policyOnConnectedLocalRegistriesDown(localRegistriesMap);
      } else if (clientType === constants.globals.NodeType.FOG) {
        policyOnConnectedFogDown(availableFogs);
      }
    }
  );
} else if (machType === "fog") {
  reggie = new Registrar(
    app,
    machType,
    id,
    fogLocalPort,
    loc,
    undefined,
    fogLocalMqttBrokerUrl,
    undefined,
    undefined,
    globalRegistryId
  );

  reggie.on("cloud-up", function (cloudId, connInfo) {
    console.log(
      "CLOUD UP: id: " +
        cloudId +
        ", ip: " +
        connInfo.ip +
        ", port: " +
        connInfo.port
    );
  });

  reggie.on("cloud-down", function (cloudId) {
    console.log("CLOUD DOWN: id: " + cloudId);
  });

  reggie.on(
    "client-offline",
    function (
      nodeId,
      clientUrl,
      clientType,
      { localRegistriesMap, availableFogs }
    ) {
      if (clientType === constants.globals.NodeType.LOCAL_REGISTRY) {
        policyOnConnectedLocalRegistriesDown(localRegistriesMap);
      }
    }
  );
} else if (machType === "cloud") {
  reggie = new Registrar(
    app,
    machType,
    id,
    globalRegistryMqttBrokerPort,
    loc,
    undefined,
    constants.mqtt.brokerUrl,
    undefined,
    undefined,
    globalRegistryId
  );
} else if (machType === "local_registry") {
  reggie = new Registrar(
    app,
    machType,
    id,
    localRegistryMqttBrokerPort,
    loc,
    undefined,
    localRegistryMqttBrokerUrl,
    undefined,
    undefined,
    globalRegistryId
  );
  
  global = new MQTTRegistry(
    app,
    machType,
    id,
    localRegistryMqttBrokerPort,
    loc,
    undefined,
    constants.mqtt.brokerUrl,
    undefined,
    undefined
  );
  
  global.registerAndDiscover();

  reggie.setStatuses(
    {
      status: function () {
        return {
          port: localRegistryMqttBrokerPort,
          ip: "10.0.0.10",
          loc: loc,
          timestamp: Date.now(),
        };
      },
    },
    true,
    global,
    constants.globals.NodeType.LOCAL_REGISTRY
  );

}

// on rare occasions, you might get an error
reggie.on("error", function (err) {
  switch (err.name) {
    case "permissions_err":
      console.log(err.message);
      console.log("Subscriptions: " + JSON.stringify(err.value));
      break;
    default:
      console.log("unknown error");
      break;
  }
});

reggie.registerAndDiscover();

//------------------------------------------------------------------------------
// Bootstrapping
//------------------------------------------------------------------------------
if (machType === "device") {
  bootstrappingNodeToFindLocalRegistries();
} else if (machType === "fog") {
  bootstrappingNodeToFindLocalRegistries();
} else if (machType === "local_registry") {
  respondToLocalRegistryDiscovery(
    1,
    localRegistryMqttBrokerIp,
    localRegistryMqttBrokerPort
  );
}

//------------------------------------------------------------------------------
// Custom attributes/discoveries
//------------------------------------------------------------------------------