const { Command } = require("commander");

const serverCli = new Command();

serverCli
  .name("jamvis")
  .description("A webapp to visualize JAMScript programs")
  .version("0.1.0")
  .usage("-u [hostname] -p [port]");

serverCli
  .option(
    "-u, --url <hostname>",
    "The URL/Hostname of the jamvis server",
    "localhost",
  )
  .option("-p, --port <port>", "The port of the jamvis server", 3000)
  .option(
    "-w, --websocket-port",
    "The port of the websocket server jamvis will create",
    8080,
  )
  .option(
    "-m, --mqtt-port",
    "The port of the mqtt server jamvis will create",
    1883,
  )
  .option("-s, --s-block-size", "The size in pixels of the s-blocks", 10)
  .requiredOption(
    "-c, --cluster <cluster>",
    "The cluster of servers to connect to",
    "localhost:6359",
  );

serverCli.parse();

const options = serverCli.opts();

const webURL = "http://" + options.url + ":" + options.port;
const wsURL = "ws://" + options.url + ":" + options.websocketPort;
const mqttURL = "mqtt://" + options.url + ":" + options.mqttPort;

const printArgs = () => {
  console.log(
    "Starting jamvis on: \t \t",
    webURL
  );
  console.log(
    "Creating WebSocket server at: \t",
    wsURL
  );

  console.log("Connecting to MQTT broker at: \t", mqttURL);
};

module.exports = {
  args: {
    httpInfo: { url: webURL, hostname: options.url, port: options.port },
    wsInfo: { url: wsURL, port: options.websocketPort },
    mqttInfo: { url: mqttURL, port: options.mqttPort },
    sBlockSize: options.sBlockSize,
  },
  printArgs: printArgs,
};
