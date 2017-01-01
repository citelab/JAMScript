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
var deviceId = deviceParams.getItem('deviceId');

// Get or make the machine registry. There could be a remote
// server as well. In that case, local storage is the cache...
var machRegistry = require('./machregistry');
machRegistry.init(cmdopts.registry, cmdopts.app);
// setup the device type: cloud, fog, or device 
setupDeviceType(machRegistry, cmdopts);

var jcond = require('./jcond');

// Make the machine state object. We will store everything There
// so that the condition evaluation can proceed. 
var machState = setupMachineState(cmdopts, function(mstate) {
	// State update handler..
	machRegistry.setAddress(mstate.deviceId, mstate.deviceAddr);
	jcond.reinit(mstate);
}, 300000);
// Update every 5 mins
jcond.init(machState);

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
	jnode.init(machState.type);

	jnode.registerCallback(testfunc, "s");
	jnode.registerCallback(resultfunc, "s");


    if (machState.type === 'cloud') {
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
	if (machState.type === 'device') {
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
		// get IP address periodically..
		machState.deviceAddr = getIPv4Address();
		callback(machState);
	}, interval);

	machState.deviceAddr = getIPv4Address();
	return machState;
}


function setupDeviceType(mregistry, copts) {

	if (copts.cloud !== undefined) 
		mregistry.setCloud(deviceId);
	else 
	if (copts.fog !== undefined)
		mregistry.setFog(deviceId);
	else
		mregistry.setDevice(deviceId);

	mregistry.setPort(deviceId, copts.port);
}


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

function getIPv4Address() {

        var niaddrs = os.networkInterfaces();
        for (var ni in niaddrs) {
                nielm = niaddrs[ni];
                for (n in nielm) {
                        if (nielm[n].family === 'IPv4' && nielm[n].internal === false)
                                return nielm[n].address
                } 
        }
        return undefined;
}


function testfunc(arg) {
	console.log("Running function testfunc.. ", arg);
}

function resultfunc(arg) {
	console.log("Running the result function ..", arg);

	return arg.length;
}

function hello(arg) {
	console.log("Testing the hello func: ", arg);
}