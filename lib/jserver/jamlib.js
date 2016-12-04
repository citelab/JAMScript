//===================================================================
// This is the main JAMLib module. It implements a generic set of
// functionality that makes it suitable for implementing the J nodes
// at the different levels: cloud, fog, and device. 
//===================================================================

// Load the global modules
var mqtt = require('mqtt');
var jnode = require('./jnode');


// Do command line processing...
var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();

// Get or make device parameters like device_id
var deviceParams = require('./deviceparams');
deviceParams.init(cmdopts.conf);
// Above call should have configured deviceId. Now we can store and retrive other
// device parameters using getItem() and setItem()

// Get or make the machine registry. There could be a remote
// server as well. In that case, local storage is the cache...
var machRegistry = require('./machregistry');
machRegistry.init(cmdopts.registry, cmdopts.app);

// Make the machine state object. We will store everything There
// so that the condition evaluation can proceed. 
var machState = setupMachineState(machRegistry, cmdopts);

// Check the presence of the MQTT server.
// If not, report an error and quit
checkMQTTServer(function(present) {
	if (!present) {
		console.log("ERROR! Cannot connect to MQTT server. Exiting.");
		process.exit(1);
	}

    // Log to Registry...
	machRegistry.startLogging();

    if (machState.type === 'cloud') {
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

// Configure the machine state using other parameters.
function setupMachineState(cmdopts) {

	// init machine state..
	machState = {};
	if (cmdopts.fog !== undefined)
		machState.type = 'fog';
	else if (cmdopts.cloud !== undefined)
		machState.type = 'cloud';
	else
		machState.type = 'device';

	machState.logging = false;
	// check and enable logging.
	if (cmdopts.log !== undefined) {
		// open the log file

		machState.logging = true;
	}

	machState.deviceId = deviceParams.getItem('deviceId');
	machState.deviceAddr = undefined;
	// The parameters below are going to be estimated somewhere else??
	machState.cloudsize = undefined;
	machState.fogsize = undefined;

	// Asynchronously find the device's IPv4 address
	dns.resolve4(os.hostname(), function(err, addr) {
		if (addr.length > 0)
			machState.deviceAddr = addr[0];
	});

	return machState;
}


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
