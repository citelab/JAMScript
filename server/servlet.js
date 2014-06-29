// Servlet
// Create a servlet constructor..

var net = require('net');

module.exports = function(host, cmdobj) {

	var commands = {};

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
	var server = net.createServer(function(c) {
		var message = getmessage(c);

		message.on('message', function(msg) {
			var handler = commands[message.name];
			if (handler !== undefined) {
				handler(message, c);
			}
		});
	}).listen(0, host, function() {
		this.running = true;
		console.log("Blah============" + server.address().port + "====" + server.address().address);
	});

	server.on('error', function(e) {
		this.running = false;
	});

	// returns an object with accessor functions that use closure to 
	// access variables local to the servlet..
	return {
		stopservlet: function() {
			server.close();
		},

		getserver: function() {
			return this.address;
		},

		getport: function() {
			return this.port;
		},

		isrunning: function() {
			return this.running;
		}
	}
}
