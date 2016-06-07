var nano = require('nanomsg'),
	cbor = require('cbor'),
	crypto = require('crypto');
	

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
	funcRegistry = {},
	activityTable = {},
	runTable = {},
	portsArray = [],
	publishBuffer = [];


//==========================================================
// INITIALIZATION SECTION
// Initialize some of the global structures here.
//==========================================================

function setupSystem() {
	// Initialize all available ports
	for (i = 8001; i < 8500; i++) {
		if (i == 8003) continue;
		portsArray.push(i);
	}

	// TODO: What else needs to be initialized?
}


//==========================================================
// FUNCTION REGISTRY SECTION
// Here we maintain the functions that can be called by 
// REXEC calls. We return failure if a call does not find
// the given function here. The call parameters are also
// important. 
//==========================================================

function test(a, b, c) {
	console.log("hello.. this is output from j-core");
	console.log(a, b, c);
	return b + c;
}


function testfg(a, b, c) {
	console.log("hello.. this is output from j-core");
	console.log(a, b, c);
	return b - c;
}

registerCallback(test, "snn");
registerCallback(testfg, "snn");


function registerCallback(fk, mask) {
	
	if (fk.name === "") {
		console.log("Anonymous functions cannot be callbacks... request ignored");
		return;
	}

	if (funcRegistry[fk.name] !== undefined) {
		console.log("Duplicate registration: " + fk.name + ".. overwritten.");
	}

	funcRegistry[fk.name] = {func: fk, mask:mask};	
}


// TODO: Complete the implementation of this function..
function runAsyncCallback(sock, cmsg) {
	
	var fentry = funcRegistry[cmsg["actname"]];
	console.log("Looking for.. [" + fentry + "].... " + cmsg["actname"]);
	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": "ASY", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["NOT-FOUND"]};		
		var encodemsg = cbor.encode(nmsg);
		sock.send(encodemsg);
		console.log("Sent the message..NOT-FOUND");
	}
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;
		
		var nmsg = {"cmd": "REXEC-ACK", "opt": "ASY", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": []};		
		var encodemsg = cbor.encode(nmsg);
		sock.send(encodemsg);
		
		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;

		console.log("Execution complete.. results stored...");		
	}	
	
}



function runSyncCallback(sock, cmsg) {
	
	var fentry = funcRegistry[cmsg["actname"]];
	console.log("Looking for.. [" + fentry + "].... " + cmsg["actname"]);
	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": "SYN", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["NOT-FOUND"]};		
		var encodemsg = cbor.encode(nmsg);
		sock.send(encodemsg);
		console.log("Sent the message..NOT-FOUND");
	}
	else
	if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": "SYN", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["ILLEGAL-PARAMS"]};		
		var encodemsg = cbor.encode(nmsg);
		sock.send(encodemsg);
		console.log("Sent the message..ILLEGAL-PARAMS");
	} 
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;
		
		var nmsg = {"cmd": "REXEC-ACK", "opt": "SYN", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": []};		
		var encodemsg = cbor.encode(nmsg);
		sock.send(encodemsg);
		
		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;

		console.log("Execution complete.. results stored...");		
	}	
}

function getResults(sock, cmsg) {
	
	var nmsg,
		res = activityTable[cmsg["actid"]];
	if (res === undefined) {
		nmsg = {"cmd": "REXEC-RES", "opt": "PUT", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": "NOT-FOUND", "args": []};
	}
	else
		nmsg = {"cmd": "REXEC-RES", "opt": "PUT", "actname": "ACTIVITY", "actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
	
	var encodemsg = cbor.encode(nmsg);
	sock.send(encodemsg);
	
	console.log("Results sent..." + res);
}


function replyWithStart(sock, msg) {
	
	
}


function checkArgsType(args, tmask) {
	
	if (args.length !== tmask.length) 
		return false;
	
	for (i = 0; i < args.length; i++) {
		if ((typeof(args[i]) === 'string') && (tmask[i] !== 's')) {
			return false;			
		}
		else
		if ((typeof(args[i]) === 'number') && (tmask[i] !== 'n')) {
			return false;
		}
	}
	return true;
}


//==========================================================
// REPLY PROCESSING SECTION
// This is meant to process the request-reply messages
//==========================================================

var rep = nano.socket('rep');
rep.bind(REPLY_URL);

setupSystem();


rep.on('data', function(buf) {
	console.log("Buffer size " + Buffer.byteLength(buf));
	cbor.decodeFirst(buf, function(error, msg) {
		// if error != null .. it seems nanomsg is
		// receiving more bytes than what the C sent..
		// TODO: investigate this pr

		try {
			adminProcessor(rep, msg, function(obj) {
				var encode = cbor.encode(msg);
				rep.send(encode);
				console.log(msg);
			});
		} catch(err) {
			console.log("errror..", err);
		}
	});
});


function adminProcessor(sock, msg, callback) {

	switch (msg["cmd"]) {
		case "REGISTER":
			console.log("REGISTERing...");
			if (msg["opt"] === "DEVICE") {
				var devidrcd = msg["actid"];
				if (devidrcd !== undefined && devTable[devidrcd] !== undefined) {
				 	var devid = getAlternateID(msg, devidrcd);
				 	var opt = "ALT";
				} else {
				 	var opt = "ORI"
					devid = devidrcd;
				}
				var port = portsArray.shift();
				console.log("Calling start req service.." + port);
				startReqService(port, function(err) {
				 	if (err === null)
				 		insertDevTableEntry(msg, devid, port);
				 	else
				 		opt = "ERR";
					msg = reviseMsgStruct(msg, "REGISTER-ACK", opt, devid, port);
				 	console.log(msg);
				 	callback(msg);
				});
			}
		break;
		default:
			console.log("Command unknown..." + msg["cmd"]);
		break;
	}

}


function startReqService(port, callback) {

	var sock = nano.socket('rep');
	var url = "tcp://*:" + port;
	console.log("Bind URL " + url);
	sock.bind(url);

	sock.on('data', function(buf) {
		console.log("In new service.. Buffer size " + Buffer.byteLength(buf));
		cbor.decodeFirst(buf, function(error, msg) {
			console.log(msg);
			if ((msg["cmd"] === "REXEC") &&
				(msg["opt"] === "SYN")) {
				runSyncCallback(sock, msg);
			}
			else
			if ((msg["cmd"] === "REXEC") &&
				(msg["opt"] === "ASY")) {
				runAsyncCallback(sock, msg);	
			}
			else
			if ((msg["cmd"] === "REXEC-RES") &&
				(msg["opt"] === "GET")) {
				getResults(sock, msg);
			}
			else
			if (msg["cmd"] === "REXEC-RDY") { 
				checkRunId(msg["actarg"]);
				replyWithStart(sock, msg);
			}
			else
			if (msg["cmd"] === "PING") {
				msg["cmd"] = "PONG";
				updateHeartBeat(msg["actid"]);
				var encode = cbor.encode(msg);
				sock.send(encode);
			}
		});
	});

	console.log("Started the service...at:" + url);
	callback(null);
}

function getAlternateID(msg, devid)
{
	var aname = msg["actname"],
		dname = msg["actarg"];

	var indx = 1;

	do {
		var tempid = aname + "|" + dname +"(" +  indx + ")";
		indx++;
	} while (devTable[tempid] !== undefined);

	console.log("ALt id " + tempid);
	return tempid;
}

function insertDevTableEntry(msg, devid, port) {

	var entry = {"app_name": msg["actname"], "device_name": msg["actid"], "port": port, "ping_time": (new Date()).getTime()};
	console.log("Entry ... for devid", devid);
	console.log(entry);
	devTable[devid] = entry;
}


function getActiveDevCount() {
	var count = 0;
	
	for (var devid in devTable) {
		var den = devTable[devid];
		if (((new Date()).getTime() - den["ping_time"]) < 50000)
			count++
	}
	
	return count;
}

function updateHeartBeat(devid) {
	console.log("Devid = " + devid);
	var den = devTable[devid];
	den["ping_time"] = (new Date()).getTime();
}


function reviseMsgStruct(msg, cmd, opt, devid, port) {
	msg["cmd"] = cmd;
	msg["opt"] = opt;
	msg["args"] = [ port, devid];

	return msg;
}



//==========================================================
// PUBLISH PROCESSING SECTION
// Setup the Publish processing section
//==========================================================

var pub = nano.socket('pub');
pub.bind(PUBLISH_DEVS_URL);

function publishMsg(msg, tag, retries) {		
	publishBuffer.push({"msg": msg, "tag": tag, "retries": retries});
}

function unpublishMsg(tag) {
	
	for (i = 0; i < publishBuffer.length; i++) {
		var elem = publishBuffer.shift();
		if (elem !== undefined && elem.tag !== tag)
			publishBuffer.push();
	}
}

setInterval(function() {
	
	for (i = 0; i < publishBuffer.length; i++) {
		var elem = publishBuffer.shift();
		if (elem !== undefined) {
			if (elem.retries-- > 0) {
				var bmsg = cbor.encode(elem.msg);
				pub.send(bmsg);
				console.log("Publishing....");
				publishBuffer.push(elem);				
			}
		}
	}
}, 2000);



//==========================================================
// EXECUTION PROCESSING SECTION
// Process different type of protocol portions
//==========================================================

var PUBLISH_RETRIES = 5;


for (i = 0; i < 10; i++) {

	console.log("Calling remote exec...");
	remoteAsyncExec("hellofk", ["mcgill university", 343 + i * 10, "canada"], "true");
}



// Specify the name of the remote task and the parameters including callbacks (names of local functions)
// as an input array.
//
function remoteAsyncExec(name, params, expr) {
	
	var tmsg = {"cmd": "REXEC-CALL", "opt": "ASY", "actname": name, "actid": "__", "actarg": expr, "args": params};
	var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
	
	tmsg["actid"] = runid;
	
	// publish the message..
	publishMsg(tmsg, runid, PUBLISH_RETRIES);
	
	// insert callback processing into the RequestSock processor
	saveRunId(runid);
}


function cancelExecTask(name, params) {
	
	var tmsg = {"cmd": "REXEC-CALL", "opt": "ASY", "actname": name, "actid": "__", "actarg": "__", "args": params};
	var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
	
	unpublishMsg(runid);
	removeRunId(runid);	
}


function checkRunId(runid) {
	
	var ren = runTable[runid];
	if (ren !== undefined) {
		ren["replied"]++;
		
		if (ren["replied"] >= ren["needed"]) {
			unpublishMsg(runid);
			removeRunId(runid);			
		}		
	}
}


function saveRunId(runid) {
	runTable[runid] = {"replied":0, "needed": Math.floor(getActiveDevCount() * 0.8) };
}

function removeRunId(runid) {
	delete(runTable[runid]);
}



//==========================================================
// SURVEY PROCESSING SECTION
// Setup the Survey processing section
//==========================================================

var sur = nano.socket('surveyor');
sur.bind(SURVEY_DEVS_URL);

// var tempmsg2 = {"cmd": "rexec", "opt": "test", "actname": "surveyor", "actid": "testid", "actarg": "ttt", "args": []};
// var encodemsg2 = cbor.encode(tempmsg2);


// setInterval(function() {
// 	console.log("Sending survey world");
// 	sur.send(encodemsg2);
// }, 2000);