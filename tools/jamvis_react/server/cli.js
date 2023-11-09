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
  .option("-w, --websocket-port", "The port of the websocket server jamvis will create", 8080)
  .requiredOption("-c, --cluster <cluster>", "The cluster of servers to connect to", "localhost:6359")

serverCli.parse();

const options = serverCli.opts()


const printArgs = (options, lengthLines) => {
  console.log('-'.repeat(lengthLines))
  console.log(
    "Starting jamvis on: \t \t",
    "http://" + options.url + ":" + options.port,
  );
  console.log(
    "Creating WebSocket server at: \t",
    "ws://" + options.url + ":" + options.websocketPort,
  );
  console.log('-'.repeat(lengthLines))
}

module.exports = {
  arguments: options,
  printArguments: printArgs
}
