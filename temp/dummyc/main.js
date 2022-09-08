// ----------------------------------------------------
// ---------------------IMPORTS------------------------
// ----------------------------------------------------
const mqttBroker = require("./utils/mqtt-broker");
const logger = require("./utils/logger");
const cbor = require("cbor-x");
const protocolManager = require("./utils/protocol-manager");
const protocolConstants = require("./constants/constants");
const testConfig = require("./constants/test-config");

// ----------------------------------------------------
// --------------------TEST CASES----------------------
// ----------------------------------------------------
const testCases = [
  {
    initiator: function (appName, mqttServer) {
      protocolManager.sendRegister(mqttServer, testConfig.registerId, appName);
    },
    validator: function (newResponses) {
      let result = false;
      newResponses.forEach((response) => {
        if (
          response.cmd === protocolConstants.CmdNames.REGISTER_ACK &&
          response.id === testConfig.registerId
        ) {
          result = true;
        }
      });
      return result;
    },
    scanningPeriod: 10000,
    scanningRetry: 10,
  },
  {
    initiator: function (appName, mqttServer) {
      protocolManager.sendGetCloudInfo(
        mqttServer,
        testConfig.registerId,
        appName
      );
    },
    validator: function (newResponses) {
      let result = false;
      newResponses.forEach((response) => {
        if (response.cmd === protocolConstants.CmdNames.PUT_CLOUD_FOG_INFO) {
          result = true;
        }
      });
      return result;
    },
    scanningPeriod: 10000,
    scanningRetry: 10,
  },
  {
    state: {
      acknowledgementReceived: false,
      timestampAcknowledgementReceived: null,
      executionTimeLimit: null,
    },
    initiator: function (appName, mqttServer) {
      protocolManager.sendExecCommand(
        mqttServer,
        appName,
        testConfig.executionTaskId,
        testConfig.executionNodeId,
        testConfig.executionFunctionWithResName,
        [12]
      );
    },
    validator: function (newResponses) {
      let result = false;
      newResponses.forEach((response) => {
        if (
          response.cmd === protocolConstants.CmdNames.REXEC_ACK &&
          response.nodeid === testConfig.executionNodeId
        ) {
          this.state.acknowledgementReceived = true;
          this.state.timestampAcknowledgementReceived = Date.now();
          this.state.executionTimeLimit = response.data;
        }

        if (
          this.state.acknowledgementReceived &&
          response.cmd === protocolConstants.CmdNames.REXEC_RES &&
          Date.now() <=
            this.state.timestampAcknowledgementReceived +
              this.state.executionTimeLimit
        ) {
          result = true;
        }
      });
      return result;
    },
    scanningPeriod: 10000,
    scanningRetry: 10,
  },
  {
    initiator: function (appName, mqttServer) {
      for (let i = 0; i < 100; i++) {
        protocolManager.sendExecCommand(
          mqttServer,
          appName,
          testConfig.executionTaskId,
          testConfig.executionNodeId,
          testConfig.executionFunctionSansResName,
          [12]
        );
      }
    },
    validator: function (newResponses) {
      return true;
    },
    scanningPeriod: 10000,
    scanningRetry: 10,
  },
  {
    initiator: function (appName, mqttServer) {
      for (let i = 0; i < 100; i++) {
        protocolManager.sendExecCommand(
          mqttServer,
          appName,
          testConfig.executionTaskId,
          testConfig.executionNodeId,
          testConfig.executionFunctionWithResName,
          [12]
        );
      }
    },
    validator: function (newResponses) {
      return true;
    },
    scanningPeriod: 10000,
    scanningRetry: 10,
  },
];

testCases.forEach((testCase) => {
  testCase.initiator = testCase.initiator.bind(testCase);
  testCase.validator = testCase.validator.bind(testCase);
});

// ----------------------------------------------------
// ----------------------TESTER------------------------
// ----------------------------------------------------
let responses = [];
let lastResponseLength = 0;
let mqttHostsToSendRequests = [];

function mqttServer(app, mqtt) {
  const LOGGER_SERVICE_NAME = "MQTT SERVER";
  mqtt.on("message", function (topic, buf) {
    let msg = cbor.decode(buf);
    logger.log(
      LOGGER_SERVICE_NAME,
      `Received message -> ${JSON.stringify(msg)}`
    );
    responses.push(msg);
    switch (topic) {
      case "/" + app + "/requests/down":
        if (msg.cmd === protocolConstants.CmdNames.REXEC) {
          if (msg.fn_name === testConfig.executionFunctionWithResName) {
            logger.log(
              LOGGER_SERVICE_NAME,
              `Remote requested execution. Sending execution acknowledgement -> msg:${JSON.stringify(
                msg
              )}`
            );
            protocolManager.sendExecAck(mqtt, app, msg);

            // Here we mock the execution of requested functions.
            const testFunc = new Function(
              `return function ${msg.fn_name}(){console.log('FAKE WORKER FUNCTION {${msg.fn_name}} EXECUTING...');}`
            )();
            testFunc();
          } else {
            logger.log(
              LOGGER_SERVICE_NAME,
              `Remote requested execution. Reporting execution failure -> msg:${JSON.stringify(
                msg
              )}`
            );
            protocolManager.sendExecErr(
              mqtt,
              app,
              msg,
              testConfig.executionErrorCode
            );
          }
        } else if (msg.cmd === protocolConstants.CmdNames.GET_REXEC_RES) {
          if (msg.fn_name === testConfig.executionFunctionWithResName) {
            logger.log(
              LOGGER_SERVICE_NAME,
              `Remote fetched results. Reporting execution response -> msg:${JSON.stringify(
                msg
              )}`
            );
            protocolManager.sendExecRes(
              mqtt,
              app,
              msg,
              testConfig.executionResult
            );
          } else {
            logger.log(
              LOGGER_SERVICE_NAME,
              `Remote fetched results. Reporting execution errors -> msg:${JSON.stringify(
                msg
              )}`
            );
            protocolManager.sendExecErr(mqtt, app, msg);
          }
        }
        break;
      case "/" + app + "/replies/down":
        if (msg.cmd === protocolConstants.CmdNames.REGISTER_ACK) {
          logger.log(
            LOGGER_SERVICE_NAME,
            `Remote acknowledged registers -> msg:${JSON.stringify(msg)}`
          );
        } else if (msg.cmd === protocolConstants.CmdNames.PUT_CLOUD_FOG_INFO) {
          logger.log(
            LOGGER_SERVICE_NAME,
            `Remote put cloud and fog info -> msg:${JSON.stringify(msg)}`
          );

          // For message `PUT_CLOUD_FOG_INFO`, we
          // assume the worker will connect to the
          // updated fogs. The worker will send
          // requests to these newly-added controllers,
          // yet the tester will not listen to their
          // responses.
          const { ip, port } = msg.data;
          const newMqttHost = mqttBroker.mqttConnect(
            testConfig.jamAppName,
            ip,
            port
          );
          mqttHostsToSendRequests.push(newMqttHost);
        } else if (msg.cmd === protocolConstants.CmdNames.REXEC_ACK) {
          logger.log(
            LOGGER_SERVICE_NAME,
            `Remote acknowledged the remote execution -> msg:${JSON.stringify(
              msg
            )}`
          );
        } else if (msg.cmd === protocolConstants.CmdNames.REXEC_RES) {
          logger.log(
            LOGGER_SERVICE_NAME,
            `Remote sent results back for REXEC -> msg:${JSON.stringify(msg)}`
          );
        } else {
          logger.log(
            LOGGER_SERVICE_NAME,
            `ERROR. Remote's reply not recognized -> msg:${JSON.stringify(msg)}`
          );
        }
        break;
      case "/" + app + "/announce/down":
        logger.log(
          LOGGER_SERVICE_NAME,
          `Remote requested ping. Sending pong -> msg:${JSON.stringify(msg)}`
        );
        protocolManager.sendPong(mqtt, app);
        break;
    }
  });
}

async function runTests() {
  const LOGGER_SERVICE_NAME = "TESTER";
  logger.log(LOGGER_SERVICE_NAME, "Start running tests.");
  const initialMqttBrokerMachine = await mqttBroker.discoverMqttServer(
    testConfig.mqttServerTagName
  );
  const initialMqttHost = mqttBroker.mqttConnect(
    testConfig.jamAppName,
    testConfig.mqttServerIpAddress,
    initialMqttBrokerMachine.port
  );
  mqttHostsToSendRequests.push(initialMqttHost);
  mqttServer(testConfig.jamAppName, initialMqttHost);

  let testsPromises = Promise.resolve("Tests Began");

  testCases.forEach((testCase, idx) => {
    let retryTimes = testCase.scanningRetry;
    testsPromises = testsPromises
      .then(() => {
        return new Promise((resolve, reject) => {
          mqttHostsToSendRequests.forEach((host) =>
            testCase.initiator(testConfig.jamAppName, host)
          );
          testCase.initiator(testConfig.jamAppName, initialMqttHost);
          resolve();
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          const interval = setInterval(() => {
            logger.log(
              LOGGER_SERVICE_NAME,
              `Validate test ${idx} for the ${retryTimes} times.`
            );

            retryTimes--;
            if (retryTimes < 0) {
              clearInterval(interval);
              reject(
                new Error(
                  `Test ${idx} failed after ${testCase.scanningRetry} validations.`
                )
              );
            }

            const result = testCase.validator(
              responses.slice(lastResponseLength)
            );
            lastResponseLength = responses.length;

            if (result) {
              logger.log(LOGGER_SERVICE_NAME, `Test ${idx} validated.`);
              clearInterval(interval);
              resolve("Success");
            }
          }, testCase.scanningPeriod);
        });
      });
  });
}

runTests();
