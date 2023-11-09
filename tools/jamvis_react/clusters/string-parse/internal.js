const dgram = require("node:dgram");
const { Command } = require("commander");
const EventEmitter = require("events");

const getCliOptions = () => {
  const internalCli = new Command();
  internalCli
    .name("internal")
    .description(
      "A server that receives messages, parses them, and send messages",
    )
    .usage("[options]")
    .option("-v, --verbose", "Verbose output", false)
    .requiredOption(
      "-l, --listen-address <hostname:port>",
      "Address to listen on",
    )
    .requiredOption(
      "-s, --send-address <hostname:port>",
      "Address to send messages to",
    )
    .requiredOption(
      "-bp, --begin-position <x,y>",
      "Beginning coordinate for area of the server",
    )
    .requiredOption(
      "-ep, --end-position <x,y>",
      "End coordinate for area of the server",
    );

  internalCli.parse();

  const options = internalCli.opts();

  // parse listen and send addresses
  const listenAddress = options.listenAddress.split(":");
  options.listen = { hostname: listenAddress[0], port: parseInt(listenAddress[1]) };
  const sendAddress = options.sendAddress.split(":");
  options.send = { hostname: sendAddress[0], port: parseInt(sendAddress[1]) };

  // parse area coordinates
  const beginPosition = options.beginPosition.split(",").map((entry) => parseInt(entry));
  const endPosition = options.endPosition.split(",").map((entry) => parseInt(entry));
  options.serverArea = {
    begin: {x: beginPosition[0], y: beginPosition[1]},
    end: {x: endPosition[0], y: endPosition[1]},
  };
  
  return options
};

const handleError = (server) => (err) => {
  if (err) {
    console.log(`server error:\n${err.stack}`);
    server.close();
  }
};

const handleSend = (server) => (obj, rinfo) => {
  server.send(
    JSON.stringify(obj),
    rinfo.port,
    rinfo.address,
    handleError(server),
  );
};

const filterStrings = (listStrings) => {
  // reducer function to create a list of valid strings
  const validStringsWithoutNumbers = (filteredList, entry) => {
    const withoutNumbers = entry.replace(/[^a-zA-Z]/gi, "");

    if (!hasRepeatedLetters(withoutNumbers)) {
      filteredList.push(withoutNumbers);
    }
    return filteredList;
  };

  const validStrings = listStrings.reduce(validStringsWithoutNumbers, []);

  return validStrings;
};

// Uses a regex to check for repeated letters
const hasRepeatedLetters = (string) => {
  const regex = /([a-zA-Z]).*?\1/;
  const hasRepeat = regex.test(string);
  return hasRepeat;
};

const serverTemplate = {
  type: "div",
  props: {
    children: {
      type: "h1",
      props: {
        align: "center",
        children: "TEXT GOES HERE",
      },
    },
  },
};

const serverInfo = {
  template: serverTemplate,
  data: new Map(),
};

const StartServer = () => {
  const options = getCliOptions();
  const server = dgram.createSocket("udp4");
  const messageHandler = new EventEmitter();
  const serverFeatures = {
    address: options.listen,
    area: options.serverArea,
    children: [],
  };

  if (options.verbose) {
    console.log(`Server Features: ${JSON.stringify(serverFeatures)}`);
  }

  // Starts server and listens on given port
  server.bind(serverFeatures.address.port);

  server.on("error", (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
  });
  server.on("listening", () => {
    if (options.verbose) {
      console.log("Listening on", options.listen);
    }
  });

  server.on("message", (msg, rinfo) => {
    const parsedMessage = JSON.parse(msg);
    // Instead of having nested if statements, we can use an event emitter
    messageHandler.emit(parsedMessage.source, parsedMessage, rinfo);
  });

  messageHandler.on("leaf", (message, rinfo) => {
    switch (message.type) {
      case "features":
        serverFeatures.children.push(message.content);
        break;
      case "data":
        serverInfo.data.set(rinfo.port, filterStrings(message.content));
        break;
    }
  });

  messageHandler.on("display", (request, rinfo) => {
    handleSend(server)(
      { type: request.type, content: serverInfo[request.type] },
      rinfo,
    );
  });

  // send features to parent server
  handleSend(server)({
    source: "internal",
    content: serverFeatures,
    type: "features",
  }, options.send);

  // send data to parent server every second
  setInterval(() => {
    server.send(
      JSON.stringify({
        source: "internal",
        type: "data",
        content: serverInfo.data,
      }),
      options.send.port,
      options.send.hostname,
      handleError(server),
    );

    if (options.verbose) {
      console.log("Sent:", serverInfo.data, "to", options.send);
    }
  }, 1000);
};

StartServer();
