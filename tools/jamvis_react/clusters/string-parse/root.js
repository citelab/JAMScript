const dgram = require("node:dgram");
const { Command } = require("commander");
const EventEmitter = require("events");

const getCliOptions = () => {
  const rootCli = new Command();
  rootCli
    .name("root")
    .description(
      "A server that receives and organizes data from internal servers",
    )
    .usage("[options]")
    .option("-v, --verbose", "Verbose output", false)
    .requiredOption("-l, --listen-address <hostname:port>", "Address to listen on")
    .requiredOption(
      "-bp, --begin-position <string>",
      "Beginning coordinate for area of the server",
    )
    .requiredOption(
      "-ep, --end-position <string>",
      "End coordinate for area of the server",
    );

  rootCli.parse();
  const options = rootCli.opts();
  
  // parse listen address
  const listenAddress = options.listenAddress.split(":");
  options.listen = { hostname: listenAddress[0], port: parseInt(listenAddress[1]) };

  // parse area coordinates
  const beginPosition = options.beginPosition.split(",").map((entry) => parseInt(entry));
  const endPosition = options.endPosition.split(",").map((entry) => parseInt(entry));
  options.serverArea = {
    begin: {x: beginPosition[0], y: beginPosition[1]},
    end: {x: endPosition[0], y: endPosition[1]},
  };
  
  return options;
}

const handleError = (server) => (err) => {
  if (err) {
    console.log(`server error:\n${err.stack}`);
    server.close();
  }
};

const serverTemplate = [{
  type: "Rectangle",
  props: { startX: 50, startY: 50, endX: 100, endY: 100}
},{
  type: "Rectangle",
  props: { startX: 100, startY: 50, endX: 150, endY: 100}
},{
  type: "Rectangle",
  props: { startX: 150, startY: 50, endX: 200, endY: 100}
  }
]
const StartServer = () => {
  const options = getCliOptions();
  const server = dgram.createSocket("udp4");
  const emitter = new EventEmitter();
  
  const serverFeatures = {
    address: options.listen,
    area: options.serverArea,
    children: [],
  };

  const serverInfo = {
    template: serverTemplate,
    data: new Map()
  }


  if (options.verbose) {
    console.log("Server Features: ", serverFeatures);
  }

  server.bind(serverFeatures.address.port);

  server.on("error", (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
  });

  server.on("message", (msg, rinfo) => {
    const parsedMessage = JSON.parse(msg);
    emitter.emit(parsedMessage.source, parsedMessage, rinfo);
  });

  emitter.on("display", (message, rinfo) => {
    // case: display requests cluster tree
    // send servers' features to display
    //
    // case: display requests data
    //
    //
    switch (message.type) {
      case "template":
        console.log("Sending template to", rinfo)
        server.send({type: "template", content: JSON.stringify(serverInfo.template)}, rinfo)
      break;
    }
    // send data to display
  })

  emitter.on("internal", (message, rinfo) => {
    console.log("received message")
    switch (message.type) {
      case "features":
        serverFeatures.children.push(message.content);
        break;
      case "data":
        // serverInfo.data.set(rinfo.port, filterStrings(message.content));

        if (options.verbose) {
          console.log("Server features:", serverFeatures)
        }
        break;
    }
  })
}

StartServer();
