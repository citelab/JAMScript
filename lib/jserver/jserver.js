// Load all the necessary modules..
var nano = require('nanomsg'),
	cbor = require('cbor'),
	events = require('events'),
	util = require('util');

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
	});
});


function processMsg(sock, msg) {
	switch(msg["cmd"]) {
		case "PING":
			console.log("Got PING....");
			// Reply with a PONG message..
			sendPong(sock, msg, function (srctype, obj) {
				// Now manipulate the local heartbeat table... if this is from a known Device or Cloud/Fog
				if (srctype == "device")
					refreshDeviceTable(obj);
				else
				if (srctype == "cloud" || srctype == "fog")
					refreshCloudTable(obj);
			});
		break;

		case "REGISTER":
			console.log("Got REGISTER....");
			// Register the device or cloud in the appropriate table..
			console.log("Register request received.. ");
			registerCore(msg, function (success, obj) {
				if (success)
					obj["opt"] = "ACK";
				else
					obj["opt"] = "NACK";
				sendMsg(sock, obj);
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

	var encoded = cbor.encode(obj);
	sock.send(encoded);
}


//==========================================================
// SURVEY PROCESSING SECTION
// This is meant to process the survey messages
//==========================================================

var surveydevs = nano.socket('surveyor');
surveydevs.bind(SURVEY_DEVS_URL);

doSurveyOnDevices();

surveydevs.on('data', function(buf) {

});


function doSurveyOnDevices() {

};


var surveyclouds = nano.socket('surveyor');
surveyclouds.bind(SURVEY_CLDS_URL);

doSurveyOnClouds();

surveyclouds.on('data', function(buf) {

});


function doSurveyOnClouds() {

};


//==========================================================
// PUBLISH PROCESSING SECTION
// This is meant to process the publish messages
//==========================================================

var publishdevs = nano.socket('pub');
publishdevs.bind(PUBLISH_DEVS_URL);

doPublishOnDevices();

publishdevs.on('data', function(buf) {

});

function doPublishOnDevices() {

};


var publishclouds = nano.socket('pub');
publishclouds.bind(PUBLISH_CLDS_URL);

doPublishOnClouds();

publishclouds.on('data', function(buf) {

});


function doPublishOnClouds() {

};


//==========================================================
// TIMEOUT PROCESSING SECTION
// This is meant to drive timeout-based actions
//==========================================================

// Check every 1 second whether we should send out heartbeats..
// This is coarse-grain timeouts for detecting the absence or presence
// of neighbors: clouds/fogs or devices
setInterval(checkHeartbeat, 1000, publishdevs, publishclouds);

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
		var devid = msg["actid"];
		console.log("Registering.." + devid);

		if (devid !== undefined && devTable[devid] !== undefined)
			cback(false, msg);
		else {
			var entry = {"attr": msg["args"], "pingTime": (new Date).getTime()};
			devTable[devid] = entry;
			console.log("Device Table.. ");
			console.log(devTable);
			// TODO: Fix this temporary devid
			msg["args"] = [ "34343" ];
			cback(true, msg);
		}
	}
	else
	{
		var clid = msg["actid"];
		if (clid !== undefined && cloudTable[clid] !== undefined)
			cback(false, msg);
		else {
			var entry = {"attr": msg["args"], "pingTime": (new Date).getTime()};
			cloudTable[clid] = entry;
			cback(true, msg);
		}
	}
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
