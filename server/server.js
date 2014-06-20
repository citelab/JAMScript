var net = require('net'),
	events = require('events'),
	util = require('util');



// Port number for the server to listen..
var PORT = 7777;
var SERVER = "localhost";

var server = net.createServer(function(c) {

	c.on('end', function () {
		console.log('Connection ended...');
	});

	c.on('error', function () {
		console.log('Connection error');
	});

	c.on('close', function () {
		console.log('Connection closed...');
	});

	var message = new Message(c);
	message.on('message', function(msg) {
		processMessage(msg, c);
	});

}).listen(PORT, SERVER);


server.on('error', function (e) {
	if (e.code == 'EADDRINUSE') {
		console.log('Address in use, retrying...');
		setTimeout(function () {
			server.close();
			server.listen(PORT, SERVER);
		}, 1000);
	}
});


// This is a function that is called synchronously?.. bad??
// However, nothing time consuming is happening inside here..
//
function processMessage(message, socket) {

	var cmd = message["name"];
	switch (cmd) {
		case "PING":
		var seqnum = message["args"][0];
		var reply = JSON.stringify({name:"PINGR", args:[(seqnum + 1), "one", "two", "three", 7877, "four"]}) + "\n";
		//console.log("Reply = " + reply);

		socket.write(reply, function () {
			console.log("Reply written...");
		});
		break;
		default:
		console.log("Message = " + message);
	}
}



Message = function(stream) {
	events.EventEmitter.call(this);
	var self = this, buffer = '';
	stream.on('data', function(data) {
		buffer += data;
		// We use '\n' (newline) as the message delimiter...
		var boundary = buffer.indexOf('\n');
		while (boundary !== -1) {
			var input = buffer.substr(0, boundary);
			buffer = buffer.substr(boundary + 1);
			self.emit('message', JSON.parse(input));
			boundary = buffer.indexOf('\n');
		}
	});
};

util.inherits(Message, events.EventEmitter);




