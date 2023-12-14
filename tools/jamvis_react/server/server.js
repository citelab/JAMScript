const { WebSocketServer } = require("ws");
const express = require("express");
const next = require("next");
const mqtt = require("mqtt");
const { args, printArgs } = require("./server-cli.js");
const {
  FatalError,
  logError,
  enums,
  shownSblocks,
} = require(
  "./utils.js",
);
const EventEmitter = require("node:events");

// Create NextJS app in dev or production mode at specified url:port
// This takes care of the routing and rendering of the React components
const dev = process.env.NODE_ENV !== "production";
const app = next({
  dev,
  hostname: args.httpInfo.hostname,
  port: args.httpInfo.port,
});
const handle = app.getRequestHandler();

const serve = () => {
  const webSockets = new Map();
  const nodes = new Map();
  const sblockContents = new Map();
  let viewportSblocks = [];
  let viewportNodes = [];

  // Used to communicate with all webSockets
  const frontendPipe = new EventEmitter();

  // Print CLI arguments
  const { httpInfo, wsInfo, mqttInfo } = args;
  printArgs();

  // Essential services
  createWebServer(httpInfo);
  const webSocketServer = createWebSocketServer(wsInfo);
  const mqttClient = createMqttClient(mqttInfo);

  mqttClient.on("connect", () => {
    // Some topics, such as block size, are subscribed to by default
    enums.sbs.INITIAL_TOPICS.map((topic) => {
      mqttClient.subscribe(topic, logError(enums.errors.SUB)(topic));
    });
  });

  const mqttMessageHandler = (topic, payload) => {
    const message = payload.toString();

    if (topic === "block-size" && !message.startsWith("size:")) {
      mqttClient.publish("block-size", "size:" + enums.sbs.S_BLOCK_SIZE);
    } else if (topic.startsWith("sblocks/")) {
      // All messages in the sblocks/ topic are in JSON format
      // They each must contain a type and a content field
      const data = JSON.parse(message);
      const type = data.type;

      // By convention, the topic is in the format sblocks/<sblockId>/node-<nodeId>
      const topics = topic.split("/");
      const id = parseInt(topics[2].split("-")[1]);
      const sblockId = parseInt(topics[1]);

      if (!nodes.has(id)) {
        const node = {
          id: id,
          sblockId: sblockId,
          outline: {},
          state: {},
        };
        nodes.set(node.id, node);
      }

      // Update the node
      const node = nodes.get(id);
      node[type] = data.content;
      node.sblockId = sblockId;

      // Add the node to its current sblock
      if (!sblockContents.has(sblockId)) {
        sblockContents.set(sblockId, []);
      }
      sblockContents.get(sblockId).push(node);

      // Notify the frontend that the node has been updated
      frontendPipe.emit(type);
    }
  };

  mqttClient.on("message", mqttMessageHandler);

  // Communicate with the frontend
  webSocketServer.on("connection", (webSocket, req) => {
    const ip = req.socket.remoteAddress;

    console.debug("New connection from", ip);
    webSockets.set(ip, webSocket);

    webSocket.on("message", (message) => {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "viewInfo":
          // The frontend has changed the viewport's position or size,
          // so the shown sblocks must be updated

          // The zoom factor affects how much of the physical world is shown
          // So the area of the viewport must be scaled by the zoom factor

          const newSblocks = shownSblocks(
            data.content,
            enums.sbs.S_BLOCK_SIZE,
            enums.sbs.WORLD_SIZE,
          );

          // Only update the shown sblocks if they have changed
          newSblocks.sort((a, b) => a - b);

          viewportSblocks = newSblocks;
          // Check each sblock in the viewport and compare its contents 
          // to the contents of the previous viewport
          for (let id of newSblocks) {
            // Server's node list for the sblock
            currentNodes = sblockContents.get(id) ;
            
            if (!currentNodes) {
              continue;
            }

            // Check each node with the viewport's node list
            for (let node of currentNodes) {
              nodeId = node.id
              // If a node is in the sblock but not in the viewport,
              // the frontend must be notified
              if (!viewportNodes.includes(nodeId)) {
                frontendPipe.emit("outline");
                break;
              }
            }
          }

          break;
      }
    });

    webSocket.on("close", (code) => {
      console.debug("Websocket at", ip, "closed with code", code);
    });
  });

  frontendPipe.on("outline", () => {
    for (let ws of webSockets.values()) {
      outlines = [];
      for (let sblock of viewportSblocks) {
        if (sblockContents.has(sblock)) {
          outlines.push(
            ...sblockContents.get(sblock).map((node) => node.outline),
          );
        }
      }
      console.log("Sending", outlines.length, "outlines");
      viewportNodes = outlines.map(node => node.id);
      ws.send(JSON.stringify({ type: "outlines", content: outlines }));
    }
  });

  frontendPipe.on("state", () => {
    for (let ws of webSockets.values()) {
      states = [];
      for (let node of nodes.values()) {
        if (shownSblocks.includes(node.sblockId)) {
          states.push(node.state);
        }
      }
      ws.send(JSON.stringify({ type: "states", content: states }));
    }
  });
};

const createWebServer = (info) => {
  const server = express();
  // API calls to be processed by external services
  server.get("/api/websocket", (_, res) => {
    return res.send(webSocketInfo);
  });

  // all other requests are processed by NextJS API Routes
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  // Start the server
  server.listen(info.port, (error) => {
    if (error) throw error;
  });

  return server;
};

const createWebSocketServer = (port) => {
  const server = new WebSocketServer(port);

  server.on("error", (error) => {
    if (error) {
      throw new FatalError("WebSocket server failed: " + error);
    }
  });

  return server;
};

const createMqttClient = ({ mqttUrl }) => {
  const client = mqtt.connect(mqttUrl);

  client.on("error", (error) => {
    if (error) {
      throw error;
    }
  });

  return client;
};

app.prepare().then(() => serve());
