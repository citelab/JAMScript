// Servlet
// Create a servlet constructor..

var net = require('net'),
	getmessage = require('./message.js');

module.exports = function(sinfo, cmdarr) {

	var commands = {};

	// set some parameters and methods
	this.servinfo = sinfo;

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
		this.server.listen(this.servinfo.port, this.servinfo.server, function() {
			self.running = true;
			console.log("Servlet running... at ", self.server.address());
			callback(self.server.address());
		});
	};

	// initialize the 'PING' command in the table..
	commands["PING"] = function(msg, sock) {
		var seqnum = msg.args[0];
		reply = JSON.stringify({name:"PINGR", args:[(seqnum + 1)]}) + "\n";
		sock.write(reply);
	};

	// install the commands in cmdarr in commands..
	for (var i = 0; i < cmdarr.length; i++) {
		if (commands[cmdarr[i].name] === undefined) {
			commands[cmdarr[i].name] = cmdarr[i].func;
		}
	};

	// this function is a contructor.. so modifies 'this' object
	that = this
	this.server = net.createServer(function(c) {
		var message = getmessage(c);

		message.on('message', function(msg) {
			var handler = commands[msg.name];
			if (handler !== undefined) {
				handler.apply(that, [c].concat(msg.args));
			}
		});
	});

	this.server.on('error', function(e) {
		this.running = false;
	});

	return this;
}
