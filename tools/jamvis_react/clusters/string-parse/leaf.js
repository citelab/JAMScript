const { Command } = require("commander");
const dgram = require("node:dgram");
const StringMessage = require("./StringMessage.js");
const leafCli = new Command();

const getCliOptions = () => {
  leafCli
    .name("leaf")
    .description("A simple server that sends random strings to other servers")
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
      "-bp, --begin-position <string>",
      "Beginning coordinate for area of the server",
    )
    .requiredOption(
      "-ep, --end-position <string>",
      "End coordinate for area of the server",
    );

  leafCli.parse();

  const options = leafCli.opts();

  // parse listen and send addresses
  const listenAddress = options.listenAddress.split(":");
  options.listen = {
    hostname: listenAddress[0],
    port: parseInt(listenAddress[1]),
  };
  const sendAddress = options.sendAddress.split(":");
  options.send = { hostname: sendAddress[0], port: parseInt(sendAddress[1]) };

  // parse area coordinates
  const beginPosition = options.beginPosition.split(",").map((entry) =>
    parseInt(entry)
  );
  const endPosition = options.endPosition.split(",").map((entry) =>
    parseInt(entry)
  );
  options.serverArea = {
    begin: { x: beginPosition[0], y: beginPosition[1] },
    end: { x: endPosition[0], y: endPosition[1] },
  };

  return options;
};

const handleError = (server) => (err) => {
  if (err) {
    console.log(`server error:\n${err.stack}`);
    server.close();
  }
};

const StartServer = () => {
  const options = getCliOptions();
  const server = dgram.createSocket("udp4");
  const msg = new StringMessage({ size: 10, minLength: 10, maxLength: 20 });

  const serverFeatures = {
    address: options.listen,
    area: options.serverArea,
    children: [],
  };

  if (options.verbose) {
    console.log(`Server Features: ${serverFeatures}`);
  }

  server.bind(serverFeatures.address.port);

  if (options.verbose) {
    console.log(
      `Listening on ${serverFeatures.address.hostname}:${serverFeatures.address.port}`,
    );
  }

  server.on("error", (err) => {
    console.log(`server error:\n${err.stack}`);
    server.close();
  });

  // send features to parent server
  server.send(
    JSON.stringify({
      source: "leaf",
      type: "features",
      content: serverFeatures,
    }),
    options.send.port,
    options.send.hostname,
    handleError(server),
  );

  // send data to parent server every second
  setInterval(() => {
    msg.updateArray();
    server.send(
      JSON.stringify({
        source: "leaf",
        type: "data",
        content: msg.stringArray,
      }),
      options.send.port,
      options.send.hostname,
      handleError(server),
    );

    if (options.verbose) {
      console.log(
        `Sent ${msg.stringArray} to ${options.send.hostname}:${options.send.port}`,
      );
    }
  }, 1000);
};

StartServer();
