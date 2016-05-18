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
	portsArray = [];


//==========================================================
// INITIALIZATION SECTION
// Initialize some of the global structures here.
//==========================================================

function setupSystem() {
	// Initialize all available ports
	for (i = 8002; i < 8500; i++)
		portsArray.push(i);

	// TODO: What else needs to be initialized?
}


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
		// TODO: investigate this pr

		try {
		processMsg(rep, msg, function(obj) {
			var encode = cbor.encode(obj);
			rep.send(encode);
		});
	} catch(err) {
		console.log("errror..", err);
	}
	});
});


function processMsg(sock, msg, callback) {

	switch (msg["cmd"]) {
		case "REGISTER":
			console.log("REGISTERing...");
			if (msg["opt"] === "DEVICE") {
				var devidrcd = msg["args"][0];
				if (devidrcd !== undefined && devTable[devidrcd] !== undefined) {
					var devid = getAlternateID(msg, devidrcd);
					var opt = "ALT";
				} else
					var opt = "ORI"
				var port = getAPort();
				startReqService(port, function(err) {
					if (err === null)
						insertDevTableEntry(msg, devid, port);
					else
						opt = "ERR";
					msg = makeNewMsg(msg, "REGISTERED", opt, devid, port);
					console.log(msg);
					callback(msg);
				});
			}
		break;
		case "DE-REGISTER":
			console.log("DE-REGISTERing...");
			if (msg["opt"] === "DEVICE") {


			}
		break;


		case "REXEC":
			console.log("REMOTE Execution...");

		break;


	}
}


function startReqService(port, callback) {

	var sock = nano.socket('rep');
	var url = "tcp://127.0.0.1:" + port;
	sock.bind(url);

	sock.on('data', function(buf) {
		console.log("In new service.. Buffer size " + Buffer.byteLength(buf));
		cbor.decodeFirst(buf, function(error, msg) {
			console.log(msg);
		});
	});

	console.log("Started the service...at:" + url);
	callback(null);
}

function getAlternateID(msg, devid)
{
	var aname = msg["actname"],
		dname = msg["devid"];

	var indx = 1;

	do {
		var tempid = aname + "|" + dname +"(" +  indx + ")";
		indx++;
	} while (devTable[tempid] !== undefined);

	return tempid;
}

function insertDevTableEntry(msg, devid, port) {

	var entry = {"app_name": msg["actname"], "device_name": msg["actid"], "port": port};
	devTable[devid] = entry;
}

function makeNewMsg(msg, cmd, opt, devid, port) {
	msg["cmd"] = cmd;
	msg["opt"] = opt;
	msg["args"].unshift(port);

	return msg;
}

function getAPort()
{
	return portsArray.shift();
}


function releasePort(port)
{
	portsArray.push(port);
}





startPubDevService(function() {
	console.log("Started the Publish service..");
});

startSurDevService(function() {
	console.log("Started the Survey service..");
});


function startPubDevService(callback) {
	var sock = nano.socket('pub');
	sock.bind(PUBLISH_DEVS_URL);

	sock.on('data', function(buf) {
		console.log("Received a publish message..");
	});

	callback();
}

function startSurDevService(callback) {
	var sock = nano.socket('surveyor');
	sock.bind(SURVEY_DEVS_URL);

	sock.on('data', function(buf) {
		console.log("Received... ");
	});

	callback();
}
