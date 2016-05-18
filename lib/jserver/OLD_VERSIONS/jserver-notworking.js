// Load all the necessary modules..
var nano = require('nanomsg'),
	cbor = require('cbor');


// Define the port number to use
var REPLY_URL = 'tcp://*:5555',
	PUBLISH_DEVS_URL = 'tcp://*:6666',
	PUBLISH_CLDS_URL = 'tcp://*:6677',
	SURVEY_DEVS_URL = 'tcp://*:7777',
	SURVEY_CLDS_URL = 'tcp://*:7788';

//==========================================================
// GLOBAL DATA STRUCTURES
// Shhh..! I am using global variables! Need to figure an
// elegant alternative. We will get through this prototype
// with this ugliness!
//==========================================================

var devTable = {},
	cloudTable = {},
	funcRegistry = {};


//==========================================================
// REPLY PROCESSING SECTION
// This is meant to process the request-reply messages
//==========================================================

var rep = nano.socket('rep');
rep.bind(REPLY_URL);

rep.on('data', function(buf) {
	console.log("Buffer size " + Buffer.byteLength(buf));
	cbor.decodeFirst(buf, function(error, msg) {
		// if error != null .. it seems nanomsg is
		// receiving more bytes than what the C sent..
		// TODO: investigate this problem.
		//
		processMsg(rep, msg)
		console.log("Helllo");
	});
});


function processMsg(sock, msg) {
	console.log("dfdsfdsfdsf");
	switch(msg["cmd"]) {

		case "REGISTER":
			console.log("Got REGISTER....");
			// Register the device or cloud in the appropriate table..
			console.log("Register request received.. ");
			registerCore(msg, function (opt, obj) {
				try {
					sendMsg(sock, obj);
				} catch (err) {
					console.log("Processed...");
				}
			});
		break;

		case "DE-REGISTER":
			// Delete Registration of the device or cloud in the appropriate table..
			deregisterCore(msg, function (success, obj) {
				if (success)
					obj["opt"] = "ACK";
				else
					obj["opt"] = "NACK";
				sendMsg(sock, obj);
			});
		break;

		case "REXEC":
			// Check the table of registered functions..
			checkExecFunction(msg, function (error, obj) {
				if (error != null) {
					// Send a NACK message for REXEC.. we did not find the function

				}
				else
				{
					// Send an ACK message for REXEC.. we are starting the execution

				}
			});
		break;
	}
}

function getMyType()
{
	return "FOG";
}


function sendPong(sock, msg, callback) {
	var src = msg["opt"];
	msg["cmd"] = "PONG";
	msg["opt"] = getMyType();

	var encoded = cbor.encode(msg);
    sock.send(encoded);
	callback(src, msg);
}

function sendMsg(sock, obj) {
	console.log("Sending.." + obj["opt"]);

	console.log(obj);

	try {
		var encoded = cbor.encode(obj);
		sock.send(encoded);
	} catch (err) {
		console.log(err);
	}
	console.log("End sendMsg");
}



//==========================================================
// TIMEOUT PROCESSING SECTION
// This is meant to drive timeout-based actions
//==========================================================

// Check every 1 second whether we should send out heartbeats..
// This is coarse-grain timeouts for detecting the absence or presence
// of neighbors: clouds/fogs or devices
//setInterval(checkHeartbeat, 1000, publishdevs, publishclouds);

function checkHeartbeat(sockd, sockc) {
	// Check the device table.. if a device needs a heartbeat, we initiate one


	// Check the cloud table.. if a cloud/fog needs a heartbeat, we initiate one


};

//==========================================================
// WORKER FUNCTIONS SECTION
// Common functions that do the work
//==========================================================

function refreshDeviceTable(obj) {
	var devid = obj["actid"];
	if (devid !== undefined && devTable[devid] !== undefined)
		devTable[devid].pingTime = getcurrenttime();
};


function refreshCloudTable(obj) {
	var clid = obj["actid"];
	if (clid !== undefined && cloudTable[clid] !== undefined)
		cloudTable[clid].pingTime = getcurrenttime();
};

function registerCore(msg, cback) {
	// Check the source to figure out how to register the core.
	if (msg["opt"] === "DEVICE") {
		var devidrecvd = msg["args"][0];
		if (devidrecvd !== undefined && devTable[devidrecvd] !== undefined) {
			var devid = getAlternateID(devidrecvd);
			var port = getFreePort();
			var entry = {"app_name": msg["actname"], "device_name": msg["actid"], "port": port};
			devTable[devid] = entry;

			// setup the return message
			msg["cmd"] = "REGISTERED";
			msg["opt"] = "ALT";
			msg["args"] = [port, devid];

			// invoke callback with "alt" option
			cback("alt", msg);
		}
		else {
			var port = getFreePort();
			var entry = {"app_name": msg["actname"], "device_name": msg["actid"], "port": port};
			devTable[devidrecvd] = entry;

			// setup the return message
			msg["cmd"] = "REGISTERED";
			msg["opt"] = "ORI";
		//	msg["args"] = [port];

			// invoke callback with "alt" option
			cback("ori", msg);
		}
	}
	cback("err", msg);
}

function getAlternateID(devid) {

	return devid;
}


function getFreePort() {
	return 8001;
}

function deregisterCore(msg, cback) {
	// Check the source to figure out how to register the core.
	if (msg["opt"] === "device") {
		var devid = msg["actid"];
		if (devid !== undefined && devTable[devid] !== undefined) {
			delete(devTable[devid]);
			cback(true, msg);
		}
		else
			cback(false, msg);
	}
	else
	{
		var clid = msg["actid"];
		if (clid !== undefined && cloudTable[clid] !== undefined) {
			delete(cloudTable[clid]);
			cback(true, msg);
		}
		else
			cback(false, msg);
	}
}

function checkExecFunction(msg, cback) {
	// Function execution should come from a device..
	if (msg["opt"] == "device") {


	}
}
