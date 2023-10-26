const { WebSocketServer } = require("ws");

const startWebSocketServer = (webSocketPort) => {
  const webSocketServer = new WebSocketServer({ port: webSocketPort });
  webSocketServer.on("error", (err) => {
    console.error(`WebSocket Server Error: ${err}`);
  });
  return webSocketServer;
};

module.exports = {
  startWebSocketServer: startWebSocketServer
}
