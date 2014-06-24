
var net = require('net');


var server = net.createServer(function (socket) {
  socket.end("goodbye\n");
});

// grab a random port.
server.listen(0, "127.0.0.1", function() {
  address = server.address();
  console.log("opened server on %j", address);
});