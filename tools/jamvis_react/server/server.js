const express = require("express");
const next = require("next");
const { arguments, printArguments } = require("./cli.js");
const { startBroker, parseTopic, parseMessage } = require("./broker.js");
const { startWebSocketServer } = require("./webSocketServer.js");

let nodes = new Map()

// Process and announce CLI Arguments
const serverInfo = {
  hostname: arguments.url,
  port: arguments.port,
};

const webSocketInfo = {
  port: arguments.websocketPort,
};

const mqttInfo = {
  port: arguments.mqttPort,
  app: arguments.app,
};
printArguments(arguments, 60);

// Create NextJS app in dev or production mode at specified url:port
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: serverInfo.hostname, port: serverInfo.port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Launch other services (mqtt, websocket, etc...)
  const webSocketServer = startWebSocketServer(webSocketInfo.port);
  const globalBroker = startBroker(
    serverInfo.hostname,
    mqttInfo.port,
    `${mqttInfo.app}/local_registry/+/status`,
  );

  const server = express();

  // API calls to be processed by external services
  server.get("/websocket", (req, res) => {
    return res.send(webSocketInfo);
  });

  // all other requests are processed by NextJS API Routes
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(serverInfo.port, (error) => {
    if (error) throw error;
    console.log("Server successfully started");
  });

  globalBroker.on("message", (topic, message) => {
    const info = parseTopic(topic)
    if (info.messageType === "status") {
      messageData = parseMessage(message);
      console.log("Global broker", info, messageData)
      console.log("Node ID", info.nodeId)
      if (messageData.payload !== "offline" && !nodes.has(info.nodeId)) {
        nodes.set(info.nodeId, messageData)
        const localBroker = startBroker(messageData.payload.ip, messageData.payload.port, '+/+/+/status');
        localBroker.on("message", (localTopic, localMessage) => {
          const localInfo = parseTopic(localTopic)
          if (!nodes.has(localInfo.nodeId)) {
            nodes.set(localInfo.nodeId, parseMessage(localMessage))
            console.log("Local Broker\n", topic, parseTopic(localTopic), parseMessage(localMessage));
          }
        });
      }
    }
  });

  webSocketServer.on("connection", (webSocket) => {
    webSocket.on("message", (data) => {
      const content = JSON.parse(data.toString());
      const fogData = Array.from(nodes.values());
      webSocket.send(JSON.stringify(fogData));
    });
  });
});
