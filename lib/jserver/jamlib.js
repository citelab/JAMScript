//===================================================================
// This is the main JAMLib module. It implements a generic set of
// functionality that makes it suitable for implementing the J nodes
// at the different levels: cloud, fog, and device.
//===================================================================

// Load the global modules
const mqtt = require('mqtt'),
	  os = require('os');

var globals = require('./globals');

// Do command line processing...
var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();

// Start up an error logger
// NOTE: This needs to be done before the logger is ever used, as this initializes the logger...
var logger = require('./jerrlog.js');
logger.init(cmdopts.app);

// Get or make device parameters like device_id
var deviceParams = require('./deviceparams');
deviceParams.init(cmdopts.conf);

var jreg = require('./jreg');
// create a Node object --> this object is the access point to all
// registration/discover functionality
var node = jreg.getNode(cmdopts, deviceParams);

// register this node with the network
node.register();

var jcond = require('./jcond');

// Setup update of the address every 1 minute
setInterval(function() {
	node.update();
	jcond.reinit(node);
}, 60000);
// Update the address to begin the process.
node.update();
jcond.init(node);

var jnode = require('./jnode');
jnode.init(node.type);

console.log("Initialized JAMLib.");

module.exports = new function() {

	this.registerFuncs = registerFuncs;
	this.run = run;
}

function run(callback) {

	// Check the presence of the MQTT server.
	// If not, report an error and quit
	checkMQTTServer(function(present) {
		if (!present) {
			console.log("ERROR! Cannot connect to MQTT server. Exiting.");
			process.exit(1);
		}

		if (node.type === globals.NodeType.CLOUD) {
			jnode.startService();
			jnode.startRunner();
		} else {
			jnode.doRegister();
			jnode.startService();
			jnode.startRunner();
		}

		if (callback !== undefined)
			callback();
	});

}

function registerFuncs(machbox) {

	// Register all callbacks in the machbox.
	// These are functions registered by the application
	fkeys = Object.keys(machbox.functions);
	for (i in fkeys) {
		tkey = fkeys[i];
		jnode.registerCallback(machbox.functions[tkey], machbox.signatures[tkey]);
	}
}

// Check whether the MQTT server is up and running..
function checkMQTTServer(callback) {
	var tserv = mqtt.connect("mqtt://localhost:" + cmdopts.port );
	tserv.on('connect', function () {
		callback(true);
		tserv.end();
	})
	tserv.on('offline', function() {
		callback(false);
		tserv.end();
	})
}
