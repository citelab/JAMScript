//===================================================================
// This is the main JAMLib module. It implements a generic set of
// functionality that makes it suitable for implementing the J nodes
// at the different levels: cloud, fog, and device. 
//===================================================================

// Load the global modules
var mqtt = require('mqtt');
var jnode = require('./jnode.js');


// Do command line processing...
var cmdParser = require('./cmdparser.js');
var cmdopts = cmdParser();

// Get or make device parameters like device_id
var getDeviceParams = require('./deviceparams.js');
var devparams = getDeviceParams('./j.conf');
// Above call should have configured the local parameters and stored values

// Check the presence of the MQTT server.
// If not, report an error and quit
checkMQTTServer(function(present) {
	if (!present) {
		console.log("ERROR! Cannot connect to MQTT server. Exiting.");
		process.exit(1);
	}

    // Log to Registry...

    // 
    if (cmdopts.cloud !== undefined) {
        jnode.startService();
    } else {
        jnode.doRegister();
        jnode.startService();
    }
});



startService implements the MQTT based definition.



// What to in Log to Registry?
// We call the function once.. it sets up a setInterval with a callback function.
// That function finds the IP address and other parameters. Updates the machine state
// with the values.
// We assume that the registry is a localstorage ..$HOME/jamstore.dat




//===================================================================
// Some local functions.. No need to put them elsewhere..
//===================================================================

// Check whether the MQTT server is up and running.. 
function checkMQTTServer(callback) {
	var tserv = mqtt.connect("mqtt://localhost");
	tserv.on('connected', function () {
		callback(true);
		tserv.end();
	})
	tserv.on('offline', function() {
		callback(false);
		tserv.end();
	})
}
