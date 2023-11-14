const express = require("express");
const dgram = require("node:dgram");
const next = require("next");
const { arguments, printArguments } = require("./cli.js");
const { startWebSocketServer } = require("./webSocketServer.js");
const { templateMessage, dataMessage, newTemplates, newData } = require(
  "./pixi-react-test.js",
);

// Process and announce CLI Arguments
const serverInfo = {
  hostname: arguments.url,
  port: arguments.port,
};

const webSocketInfo = {
  url: arguments.url,
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
  const webSockets = new Map();

  // API calls to be processed by external services
  server.get("/api/websocket", (req, res) => {
    return res.send(webSocketInfo);
  });

  // all other requests are processed by NextJS API Routes
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(serverInfo.port, (error) => {
    if (error) throw error;
  });

  const templates = newTemplates(50);
  // communcation with the client
  webSocketServer.on("connection", (webSocket, req) => {

    // store webSocket information index by its ip
    const ip = req.socket.remoteAddress
    webSockets.set(ip, webSocket);
    console.log("New connection from", ip)

    // handle incoming messages
    webSocket.on("message", (message) => {
      const parsedMessage = JSON.parse(message.toString())

      if (parsedMessage.type === "template") {
        webSocket.send(templateMessage(templates))
      }
    })  

    webSocket.on("close", (code) => {
      console.log("Websocket at", ip, "closed with code", code)
    })
  });


  // send data to all connected websockets
  setInterval(() => {
    let myTemplates = [...templates]
    for (let webSocket of webSockets.values()) {
      const positionChanges = newData({ min: -30, max: 30 })(myTemplates)
      const newPositions = []
      myTemplates = myTemplates.map((node, index) => {
        const myNode = {...node}
        myNode.position.x += positionChanges[index].x
        myNode.position.y += positionChanges[index].y
        newPositions.push({x: myNode.position.x, y: myNode.position.y})
        return myNode
      })
      
      const data = dataMessage(newPositions)
      webSocket.send(data)
    }
  }, 10);

  // communication with the cluster of servers
  // Step 1: Connect to root server
  // const datagram = dgram.createSocket("udp4");
  // const rootServer = arguments.cluster.split(":");
  // datagram.send(
  //   JSON.stringify({ source: "display", type: "template" }),
  //   rootServer[1],
  //   rootServer[0],
  //   (err) => {
  //     if (err) {
  //       console.log(`Could not send message of type ${obj.type} to ${rinfo}`);
  //     }
  //   },
  // );
  //
  // datagram.on("message", (message, rinfo) => {
  //   parsedMessage = JSON.parse(message);
  //   switch (parsedMessage.type) {
  //     case ("template"):
  //       template = parsedMessage.content;
  //   }
  // });
});
