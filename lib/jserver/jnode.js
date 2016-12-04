//===================================================================
// This is the main processor for J nodes. 
// All types of processing are done here.
//===================================================================

// Load some global modules
var mqtt = require('mqtt');
var deviceParams = require('./deviceparams.js');

// Global variables for the module. I don't think these variable go into the
// global namespace.. so it is OK.

var devTable = {},
	funcRegistry = {},
	activityTable = {};


module.exports = new function() {

    // Connect to the server.. we know the server is there..
    var mserv = mqtt.connect("mqtt://localhost");

    this.registerCallback = registerCallback;
    
	this.remoteSyncExec = async (function (name, params, expr) {

        // Needs to be implemented using the new synchronization protocol
    });

	this.remoteAsyncExec = remoteAsyncExec;
    
    this.startService = startService;

    this.doRegister = doRegister;

}


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


function remoteAsyncExec(name, params, expr) {

    // Needs to be implemented using the new protocol
}


function startService() {

    mserv.on('connect', function() {
        mserv.subscribe('/admin/request/all');
        mserv.subscribe('/level/func/request');    
        mserv.subscribe('/mach/func/reply');        
    });
    mserv.on('reconnect', function() {
        mserv.subscribe('/admin/request/all');
        mserv.subscribe('/level/func/request');
        mserv.subscribe('/mach/func/reply');                                                        
    });

    mserv.on('message', function(topic, buf) {

        cbor.decodeFirst(buf, function(error, msg) {

            switch (topic) {
                case '/admin/request/all':
                // Requests are published here by nodes under this broker
                    try {
                        adminService(msg, function(rmsg) {
                            var encode = cbor.encode(rmsg);
                            mserv.publish('/admin/announce/all', encode);
                        });
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;

                case '/level/func/request':
                // These are requests by the C nodes under this broker
                // The requests are published from device and fog levels
                    try {
                        levelService(msg, function(rmsg) {
                            var encode = cbor.encode(rmsg);
                            mserv.publish('/level/func/reply/' + msg["actarg"], encode);
                        });
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;

                case '/mach/func/reply':
                // Replies are bubbling upwards. So these are publications 
                // coming from submachines.
                    try {
                        machService(msg, function(rmsg) {
                            var encode = cbor.encode(rmsg);
                            mserv.publish('/mach/func/reply/' + msg["actarg"], encode);                                
                        });
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;
            }
        });   
    });
}


// The admin service handler..
//
// [[ REGISTER DEVICE app_name _ device_serial ]]
// We are using UUID4 for device_serial. It is assumed to be universally unique (with collisions rare).
// The broker will check the device_id in its table. If it is found in the table, 
// sends the following message to /admin/announce/all. 
// [[ REGISTER-ACK OLD broker_serial _ device_serial ]]
// else sends the following
// [[ REGISTER-ACK NEW broker_serial _ device_serial ]]
function adminService(msg, callback) {

    switch (msg['cmd']) {
        case 'REGISTER':
            rdevid = msg['actarg'];            
            msg['cmd'] = 'REGISTER-ACK';
            msg['actid'] = devParams.getItem('deviceId');
            if (devTable[rdevid] === undefined) {
                // Registration request is for a new device
                msg['opt'] = 'NEW';
                devTable[rdevid] = Date.now();
                callback(msg);
            } else {
                // Request for a devices already registered
                msg['opt'] = 'OLD';
                callback(msg);
            }
        break;
        default:
            console.log('AdminService:: UNKNOWN CMD: ' + msg['cmd'] + ' received.. ');
            throw('UNKNOWN COMMAND');
    }
}


// The level service handler..
//
function levelService(msg, callback) {
    
    switch (msg['cmd']) {
        case 'REXEC-SYN':
            // broker is processing [[ REXEC-SYN condition-string/- actname actid device_id args ]]
            // Check the actname, return error if not found
            // Check condition string, return error if not true
            // Send positive ack in other cases
            runSyncCallback(msg, callback);
        break;
        case 'REXEC-ASY':
            // Processing: [[ REXEC-ASY condition-string/- actname actid device_id args ]]
            // Check the actname, return error if not found
            // Check condition string, return error if not true
            // Send positive ack in other cases
            runAsyncCallback(msg, callback);
        break;
        case 'REXEC-RES':
            // Get the results
            // TODO: Implement this one.
            getResults(msg, callback);
            break;
        default:
            console.log('LevelService:: UNKNOWN CMD: ' + msg['cmd'] + ' received..');
            throw('UNKNOWN COMMAND');
    }
}

// This function does the following..
// One success.. it calls the callback with the following message
// [[ REXEC-ACK - ACTIVITY actid device_id lease-value (arg0) ]]
// It fails on many conditions: function not found, condition not true,
// illegal parameters, etc. Sends the following message on failure
// [[ REXEC-NAK - ACTIVITY actid device_id error-code (arg0) ]]
//
function runSyncCallback(cmsg, callback) {

	var fentry = funcRegistry[cmsg["actname"]];
	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": "SYN", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["NOT-FOUND"]};
		callback(nmsg);
	}
	else
	if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": "SYN", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["ILLEGAL-PARAMS"]};
		callback(nmsg);
		console.log("Sent the message..ILLEGAL-PARAMS");
	}
    else
    if (jcond.checkCondition(cmgs["opt"]) !== true) {
        // send an REXEC-NAK message: {REXEC-NAK SYN, ACTIVITY, actid, device_id, error_code}
        var nmsg = {"cmd": "REXEC-NAK", "opt": "SYN", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["CONDITION-FALSE"]};
		callback(nmsg);
		console.log("Sent the message..CONDIITON FALSE");
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;

		var nmsg = {"cmd": "REXEC-ACK", "opt": "SYN", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": []};
        callback(nmsg);

		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;
		console.log("Execution complete.. results stored...");
	}
}


function runAsyncCallback(cmsg, callback) {

	var fentry = funcRegistry[cmsg["actname"]];
	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
	    var nmsg = {"cmd": "REXEC-NAK", "opt": "ASY", "actname": "ACTIVITY",
		 "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["NOT-FOUND"]};
        callback(nmsg);
		console.log("Sent the message..NOT-FOUND");
	}
    if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": "ASY", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["ILLEGAL-PARAMS"]};
		callback(nmsg);
		console.log("Sent the message..ILLEGAL-PARAMS");
	}
    else
    if (jcond.checkCondition(cmgs["opt"]) !== true) {
        // send an REXEC-NAK message: {REXEC-NAK ASY, ACTIVITY, actid, device_id, error_code}
        var nmsg = {"cmd": "REXEC-NAK", "opt": "ASY", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["CONDITION-FALSE"]};
		callback(nmsg);
		console.log("Sent the message..CONDIITON FALSE");
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;

		var nmsg = {"cmd": "REXEC-ACK", "opt": "ASY", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": []};
        callback(nmsg);

		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;
		console.log("Execution complete.. results stored...");
	}
}


function getResults(cmsg, callback) {

	var nmsg,
		res = activityTable[cmsg["actid"]];
	if (res === undefined) 
		nmsg = {"cmd": "REXEC-RES", "opt": "PUT", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": "NOT-FOUND", "args": []};
	else
		nmsg = {"cmd": "REXEC-RES", "opt": "PUT", "actname": "ACTIVITY", 
		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
    
    callback(nmsg);
}




// The machine service handler..
//
function machService(msg, callback) {
   
}


function doRegister() {

}

