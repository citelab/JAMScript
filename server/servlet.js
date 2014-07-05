// Servlet
// Create a servlet constructor..

var net = require('net'),
	getmessage = require('./message.js');

module.exports = function(host, cmdobj) {

	var commands = {};

	// set some parameters and methods
	this.host = host;

	this.stopservlet =  function() {
		this.server.close();
	};

	this.getserver =  function() {
		return this.address;
	};

	this.getport = function() {
		return this.port;
	};

	this.isrunning = function() {
		return this.running;
	};

	this.run = function(callback) {

		var self = this;
		this.server.listen(0, this.host, function() {
			self.running = true;
			callback(self.server.address());
		});
	}

	// initialize the 'PING' command in the table..
	commands["PING"] = function(msg, sock) {
		var seqnum = msg.args[0];
		reply = JSON.stringify({name:"PINGR", args:[(seqnum + 1)]}) + "\n";
		sock.write(reply);
	}

	// install the commands in cmdobj in commands..
	for (var cmd in cmdobj) {
		if (commands[cmd] === undefined) {
			commands[cmd] = cmdobj[cmd];
		}
	}

	// this function is a contructor.. so modifies 'this' object
	this.server = net.createServer(function(c) {
		var message = getmessage(c);

		message.on('message', function(msg) {
			var handler = commands[msg.name];
			if (handler !== undefined) {
				handler(msg, c);
			}
		});
	});

	this.server.on('error', function(e) {
		this.running = false;
	});

	return this;
}