const express = require("express");
const dgram = require("node:dgram");
const next = require("next");
const { arguments, printArguments } = require("./cli.js");
const { startWebSocketServer } = require("./webSocketServer.js");

// Process and announce CLI Arguments
const serverInfo = {
  hostname: arguments.url,
  port: arguments.port,
};

const webSocketInfo = {
  port: arguments.websocketPort,
};

printArguments(arguments, 60);

// Create NextJS app in dev or production mode at specified url:port
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: serverInfo.hostname, port: serverInfo.port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const webSocketServer = startWebSocketServer(webSocketInfo.port);
  const server = express();
  const webSockets = [];

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

  // communcation with the client
  webSocketServer.on("connection", (webSocket) => {
    webSockets.push(webSocket)
    webSocket.on("message", (data) => {
      // example template
      const template = {
        type: "Sprite",
        props: {
          image: "image/cloud-fog.png",
        },
      }
      // send to client 
      webSocket.send(JSON.stringify({ type: "template", content: template}))
    });
  });

  const exampleData = { height: 512, width: 512 }
  setInterval(() => {
    // update data
    exampleData.height += exampleData.height > 512 ? -50 : 50
    exampleData.width += exampleData.width > 512 ? -50 : 50
    for (let webSocket of webSockets) {
      webSocket.send(JSON.stringify({type: "data", content: exampleData}))
    }
  }, 1000)
  // communication with the cluster of servers 
  // Step 1: Connect to root server 
  const datagram = dgram.createSocket("udp4")
  const rootServer = arguments.cluster.split(":")
  datagram.send(JSON.stringify({source: "display", content: { type: "clusterTree"}}), rootServer[1], rootServer[0], (err) => {
    if (err) {
      console.log(`Could not send message of type ${obj.type} to ${rinfo}`);
    }
  })
  // Step 2: Cache tree of servers 
  //
  // Step 3: Send messages to servers based on client position
});
