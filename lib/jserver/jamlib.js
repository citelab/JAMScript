//===================================================================
// This is the main JAMLib module. It implements a generic set of
// functionality that makes it suitable for implementing the J nodes
// at the different levels: cloud, fog, and device. 
//===================================================================

// Load the global modules
const mqtt = require('mqtt'),
	  os = require('os');

// Do command line processing...
var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();

// Get or make device parameters like device_id
var deviceParams = require('./deviceparams');
deviceParams.init(cmdopts.conf);

// Get or make the machine registry. There could be a remote
// server as well. In that case, local storage is the cache...
var machRegistry = require('./machregistry');
machRegistry.init(cmdopts, deviceParams);

var jcond = require('./jcond');
var machbox = require('./machbox');

// Setup update of the address every 1 minute
setInterval(function() {
	machRegistry.update();
	jcond.reinit(machRegistry);
}, 60000);
// Update the address to begin the process.
machRegistry.update();
jcond.init(machRegistry);

// TODO: The program flow up to this point.. has been messy.
// We need to clean it up.

// Check the presence of the MQTT server.
// If not, report an error and quit
checkMQTTServer(function(present) {
	if (!present) {
		console.log("ERROR! Cannot connect to MQTT server. Exiting.");
		process.exit(1);
	}

	var jnode = require('./jnode');
	jnode.init(machRegistry.type);

	// Register all callbacks in the machbox. 
	// These are functions registered by the application
	fkeys = Object.keys(machbox.functions);
	console.log("========== Functions to register: ", fkeys);
	for (i in fkeys) {
		tkey = fkeys[i];
		jnode.registerCallback(machbox.functions[tkey], machbox.signatures[tkey]);
	}

    if (machRegistry.type === 'cloud') {
		console.log("Cloud service...started..");
        jnode.startService();
		jnode.startRunner();
    } else {
		console.log("Fog/devices service...started..");
        jnode.doRegister();
		jnode.startService();
		jnode.startRunner();
    }

	console.log("---------------------xxxx ----------");
	// Test Machine functions...
	if (machRegistry.type === 'device') {
		console.log("Sending Remote Async... hello");
			try {
				jnode.remoteSyncExec("hello", ["===Param Maheswaran ===="], "true");
			//jnode.remoteAsyncExec("hello3", ["===Param Maheswaran ===="], "true");
			} catch(e) {
				console.log(e);
			}
	}
});


//===================================================================
// Some local functions.. No need to put them elsewhere..
//===================================================================


// Check whether the MQTT server is up and running.. 
function checkMQTTServer(callback) {
	var tserv = mqtt.connect("mqtt://localhost:" + cmdopts.port );
	tserv.on('connect', function () {
		console.log("Check connection ok...");
		callback(true);
		tserv.end();
	})
	tserv.on('offline', function() {
		console.log("Check connection not ok...");
		callback(false);
		tserv.end();
	})
}