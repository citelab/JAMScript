// ----------------------------------------------------
// ----------------------IMPORTS-----------------------
// ----------------------------------------------------
const testConfig = require("../constants/test-config");
const logger = require("../utils/logger");
const mqtt = require("mqtt");
const cbor = require("cbor-x");
const udp = require("dgram");
const constants = require("../constants/constants");

// ----------------------------------------------------
// -----------------------UTILS------------------------
// ----------------------------------------------------
function discoverMqttServer(tagName) {
  const LOGGER_SERVICE_NAME = "DISCOVER MQTT SERVER";
  logger.log(
    LOGGER_SERVICE_NAME,
    `Start discovering MQTT server with tag name ${tagName}`
  );
  const listener = udp.createSocket({ type: "udp4", reuseAddr: true });
  const sender = udp.createSocket({ type: "udp4", reuseAddr: true });

  listener.bind(
    testConfig.mqttMulticastPort,
    testConfig.mqttMulticastAddr,
    function () {
      listener.addMembership(testConfig.mqttMulticastAddr);
      listener.setBroadcast(true);
    }
  );

  let count = 20;
  let serverFound = false;

  listener.on("message", (msg, err) => {
    qmsg = cbor.decode(msg);

    logger.log(
      LOGGER_SERVICE_NAME,
      `Received message -> ${JSON.stringify(qmsg)}`
    );

    if (qmsg.cmd === constants.CmdNames.HERE_IS_CTRL) {
      serverFound = true;
    }
  });

  return new Promise((resolve, reject) => {
    const repeater = setInterval(() => {
      if (serverFound) {
        logger.log(LOGGER_SERVICE_NAME, `Found server! Y(^_^)Y`);
        sender.close();
        listener.close();
        clearInterval(repeater);
        resolve(qmsg.data);
      } else {
        let rmsg = { cmd: constants.CmdNames.WHERE_IS_CTRL, tag: tagName };
        let data = cbor.encode(rmsg);

        logger.log(
          LOGGER_SERVICE_NAME,
          `Sending the request [Remaining: ${count}] -> rmsg:${JSON.stringify(
            rmsg
          )}`
        );

        sender.send(
          data,
          0,
          data.length,
          testConfig.mqttMulticastPort,
          testConfig.mqttMulticastAddr
        );
        count--;
        if (count < 0) {
          logger.log(LOGGER_SERVICE_NAME, "Maximum retries reached.");
          reject(0);
        }
      }
    }, 500);
  });
}

function mqttConnect(app, ip, portNumber) {
  const brokerAddress = `tcp://${ip}:${portNumber}`;
  const broker = mqtt.connect(brokerAddress, testConfig.mqttConnectionOptions);
  broker.on("connect", function () {
    broker.subscribe("/" + app + "/announce/down");
    broker.subscribe("/" + app + "/replies/down");
    broker.subscribe("/" + app + "/requests/down");
  });
  broker.on("reconnect", function () {
    broker.subscribe("/" + app + "/announce/down");
    broker.subscribe("/" + app + "/replies/down");
    broker.subscribe("/" + app + "/requests/down");
  });

  logger.log(
    "MQTT BROKER",
    `Connected to MQTT Broker -> ADDR:${brokerAddress}`
  );

  return broker;
}

// ----------------------------------------------------
// ----------------------EXPORTS-----------------------
// ----------------------------------------------------
module.exports = Object.freeze({
  mqttConnect: mqttConnect,
  discoverMqttServer: discoverMqttServer,
});
