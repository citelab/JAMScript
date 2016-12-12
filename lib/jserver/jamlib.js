//===================================================================
// This is the main JAMLib module. It implements a generic set of
// functionality that makes it suitable for implementing the J nodes
// at the different levels: cloud, fog, and device. 
//===================================================================

// Load the global modules
var mqtt = require('mqtt');

// Do command line processing...
var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();
console.log("App = ", cmdopts.app);

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
var machState = setupMachineState(cmdopts, function(mstate) {
	// State update handler..
	machRegistry.setAddress(mstate.deviceId, mstate.deviceAddr);
	// TODO: What else?
}, 300000);
// Update every 5 mins

// Check the presence of the MQTT server.
// If not, report an error and quit
checkMQTTServer(function(present) {
	if (!present) {
		console.log("ERROR! Cannot connect to MQTT server. Exiting.");
		process.exit(1);
	}


	var jnode = require('./jnode');
    if (machState.type === 'cloud') {
		console.log("Cloud service...started..");
        jnode.startService();
    } else {
		console.log("Fog/devices service...started..");
        // jnode.doRegister();
		jnode.startService();
    }
});


//===================================================================
// Some local functions.. No need to put them elsewhere..
//===================================================================

// Configure the machine state using other parameters.
function setupMachineState(cmdopts, callback, interval) {

	// init machine state..
	var machState = {};
	if (cmdopts.fog !== undefined)
		machState.type = 'fog';
	else if (cmdopts.cloud !== undefined)
		machState.type = 'cloud';
	else
		machState.type = 'device';

	machState.deviceId = deviceParams.getItem('deviceId');
	machState.deviceAddr = undefined;
	// The parameters below are going to be estimated somewhere else??
	machState.cloudsize = undefined;
	machState.fogsize = undefined;

	setInterval(function() {
		// Asynchronously find the device's IPv4 address
		dns.resolve4(os.hostname(), function(err, addr) {
			if (addr.length > 0)
				machState.deviceAddr = addr[0];
				callback(machState);
		});
	}, interval);

	return machState;
}


// Check whether the MQTT server is up and running.. 
function checkMQTTServer(callback) {
	var tserv = mqtt.connect("mqtt://localhost");
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
