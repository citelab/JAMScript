//===================================================================
// This is the main processor for J nodes. 
// All types of processing are done here.
//===================================================================

var async = require('asyncawait/async'),
	await = require('asyncawait/await'),
    cbor = require('cbor'),
    crypto = require('crypto');


// Load some global modules
var mqtt = require('mqtt');
var deviceParams = require('./deviceparams');
var machRegistry = require('./machregistry');
var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();

// Global variables for the module. I don't think these variable go into the
// global namespace.. so it is OK.

var devTable = {},
	funcRegistry = {},
	activityTable = {},
    runTable = {};

var mserv = undefined;
var cserv = undefined;
var fserv = undefined;

var jcond;
var machtype = undefined;


module.exports = new function() {

    // Connect to the server.. we know the server is there..
    console.log("Connect exec..");
    mserv = mqtt.connect("tcp://localhost:" + cmdopts.port);
    console.log("Connect exec. done");

    this.init = function (mtype) {
        machtype = mtype;
    }

    this.registerCallback = registerCallback;
    
	this.remoteSyncExec = async (function (name, params, expr) {

        try {
            // TODO: We need to put the new time-based synchronization scheme here..
            await(remoteSyncExecute(name, params, expr));
        } catch (e) {
            console.log(e);
        }
    });

	this.remoteAsyncExec = remoteAsyncExec;

    this.machAsyncExec = machAsyncExec; 

    this.machSyncExec = async (function machSyncExec(name, params, expr) {
        
        try {
            console.log("Over.... here");
            // TODO: We need to put the new time-based synchronization scheme here..
            await(machSyncExecute(name, params, expr));
            console.log("Done .");
        } catch (e) {
            console.log(e);
        }
        
    });

 
    this.startService = startService;
    this.startRunner = startRunner;
    this.doRegister = doRegister;
}


// =============================================================================
// Interface functions. These are exported by the module interface
// They are directly used to execute functions from the JAMScript user program
// =============================================================================

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


function remoteSyncExecute(name, params, expr) {

    return new Promise(function(resolve, reject) {

        if (machtype == 'DEVICE') {
            // send out the execute to the C side..
            var tmsg = {"cmd": "REXEC-SYN", "opt": expr, "actname": name, "actid": "-", "actarg": "-", "args": params};
            var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
            
            // set the actid to runid so we can find get the correct runTable entry at acknowledgment
            tmsg.actid = runid
            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine 
            insertRunTable(runid, function(rstatus) {

                // Run the function after getting a successfull ACK
                if (rstatus == 'ACK') {
                    deleteRunTable(runid);
                    resolve("Got ACK");
                }
                else
                    reject("Did not get ACK"); 
            });

            mserv.publish('/mach/func/request', cbor.encode(tmsg));

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds? 
            setTimeout(function () {
                deleteRunTable(runid);
                reject("Timed out...");
            }, 300);
        }
        else 
        {   
            // send out the REXEC-INQ message to get the status of the execution..
            // TODO: What to do with the status?? At this point, nothing is done with it.
            var tmsg = {"cmd": "REXEC-ASY", "opt": expr, "actname": name, "actid": "-", "actarg": "-", "args": params};
            // We get the same runid as the previous actual execution.. now change to REXEC-INQ
            tmsg.cmd = "REXEC-INQ";
            var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
            
            // set the actid to runid so we can find get the correct runTable entry at acknowledgment
            tmsg.actid = runid
            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine 
            insertRunTable(runid, function(rstatus) {
                // invoke the callback with the status..
                callback(rstatus); 
                deleteRunTable(runid);
                resolve(true);
            });

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds? 
            setTimeout(function () {
                deleteRunTable(runid);
                reject(true);                
            }, 300);
        }
    });
}


function remoteAsyncExec(name, params, expr, callback) {

    if (machtype == 'DEVICE') {
        // send out the execute to the C side..
        var tmsg = {"cmd": "REXEC-ASY", "opt": expr, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        insertRunTable(runid, function(rstatus) {

            // Run the function after getting a successfull ACK
            if (rstatus == 'ACK') 
                deleteRunTable(runid);
        });

        mserv.publish('/mach/func/request', cbor.encode(tmsg));

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
        }, 300);
    }
    else 
    {   
        // send out the REXEC-INQ message to get the status of the execution..
        // TODO: What to do with the status?? At this point, nothing is done with it.
        var tmsg = {"cmd": "REXEC-ASY", "opt": expr, "actname": name, "actid": "-", "actarg": "-", "args": params};
        // We get the same runid as the previous actual execution.. now change to REXEC-INQ
        tmsg.cmd = "REXEC-INQ";
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        insertRunTable(runid, function(rstatus) {
            // invoke the callback with the status..
            callback(rstatus); 
            deleteRunTable(runid);
        });

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
        }, 300);
    }
}


function machSyncExecute(name, params, expr) {

    return new Promise(function(resolve, reject) {

        if (machtype === 'DEVICE') {
            if (eval(expr)) {
                // run the function in variable 'name' locally.. it might trigger a remote call to C
                try {
                    eval(name)(params);
                    resolve(true);
                } catch(e) {
                    reject(e);
                }
            }
            else 
                reject(false);
        }
        else 
        {
            // Create the execution call.. message 
            var tmsg = {"cmd": "MEXEC-SYN", "opt": expr, "actname": name, "actid": "-", "actarg": "-", "args": params};
            var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
            // set the actid to runid so we can find get the correct runTable entry at acknowledgment
            tmsg.actid = runid

            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine 
            insertRunTable(runid, function(rstatus) {

                // Run the function after getting a successfull ACK
                if (rstatus == 'ACK') { 
                    eval(name)(params);
                    resolve(true);
                } else
                    reject(false);
                // TODO: There could be bug here.. check here and in the Async version??
                deleteRunTable(runid);
            });

            console.log("Publishing the message...", tmsg);

            // Publish it to the sub machine..
            var encode = cbor.encode(tmsg);
            mserv.publish('/mach/func/request', encode);

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds? 
            setTimeout(function () {
                deleteRunTable(runid);
                reject(false);
            }, 300);
        }
    });
}



function machAsyncExec(name, params, expr) {

    // If the current node is device, just execute the function.
    if (machtype === 'DEVICE') {
        // TODO: fix this.. we are using "eval" to evaluate the jconditional expr!!
        if (eval(expr)) {
            // run the function "name" locally.. it might trigger a remote call to C devices
            console.log("Name ", name);
            console.log("params ", params);
            eval(name)(params);
        }
    }
    else 
    {
        // Create the execution call.. message 
        var tmsg = {"cmd": "MEXEC-ASY", "opt": expr, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        insertRunTable(runid, function(rstatus) {

            // Run the function after getting a successfull ACK
            if (rstatus == 'ACK') 
                eval(name)(params);
            deleteRunTable(runid);
        });

        console.log("Publishing the message...", tmsg);

        // Publish it to the sub machine..
        var encode = cbor.encode(tmsg);
        mserv.publish('/mach/func/request', encode);

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
        }, 300);
    }
}


function doRegister() {

    // IMPORTANT:: in the cloud -- fserv and cserv are undefined.
    //

    if (machtype === 'DEVICE') {
        // Register as a device.. so we need to find a fog
        if ((fog = machRegistry.getAFog()) !== undefined) {
            console.log("Fog: ", fog);
            url = machRegistry.getURL(fog);
            console.log("Fog URL: ", url)
            if (url !== undefined) 
                fserv = mqtt.connect(url);
            else
                console.log("WARNING! Unable to connect to a fog.");
        }
        else 
            console.log("WARNING! Unable to connect to a fog.");
    }
    else 
    if (machtype === 'FOG') {       
        // Register as a fog..only the cloud is needed.
        if ((cloud = machRegistry.getTheCloud()) !== undefined) {
            url = machRegistry.getURL(cloud);
            console.log("Cloud URL: ", url);
            if (url !== undefined) 
                cserv = mqtt.connect(url);
            else
                console.log("WARNING! Unable to connect to the cloud..");
        }
    }
}


function startService() {

    if (machtype === undefined) {
        console.log("ERROR! Machine type is not set; should be: device, fog, or cloud");
        process.exit(1);
    } 

    jcond = require('./jcond');

    console.log("Starting the service...");
    mserv.on('connect', function() {
        console.log("Connected...");
        mserv.subscribe('/admin/request/all');
        mserv.subscribe('/level/func/request');    
        mserv.subscribe('/mach/func/reply');    

        // Send a ping every 500 milliseconds. This is needed so that the clients waiting at the
        // broker will know about a newly joining broker 
        //
        setInterval(function() {
            var tmsg = {"cmd": "PING", "opt": "BROKER", "actname": "-", "actid": "-", "actarg": "-", "args": []};
            var encode = cbor.encode(tmsg);
            process.stdout.write(".");
            mserv.publish('/admin/announce/all', encode);
        }, 500);

    });
    mserv.on('reconnect', function() {
        mserv.subscribe('/admin/request/all');
        mserv.subscribe('/level/func/request');
        mserv.subscribe('/mach/func/reply');                                                        

        // Send a ping every 500 milliseconds. This is needed so that the clients waiting at the
        // broker will know about a newly joining broker 
        //
        setInterval(function() {
            var tmsg = {"cmd": "PING", "opt": "BROKER", "actname": "-", "actid": "-", "actarg": "-", "args": []};
            var encode = cbor.encode(tmsg);
            process.stdout.write(".");
            mserv.publish('/admin/announce/all', encode);
        }, 500);
    });

    mserv.on('message', function(topic, buf) {
        console.log("REcv...");
        cbor.decodeFirst(buf, function(error, msg) {

            switch (topic) {
                case '/admin/request/all':
                // Requests are published here by nodes under this broker
                    try {
                        adminService(msg, function(rmsg) {
                            var encode = cbor.encode(rmsg);
                            console.log(".");
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
                            console.log("Publishing the response...", rmsg);
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
                        machAsyncService(msg);
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;
            }
        });   
    });
}


function startRunner() {

    var sock;

    // No need to check this.. it is already done.. but to ensure
    if (machtype === undefined) {
        console.log("ERROR! Machine type not set..");
        process.exit(1);
    }

    // Cloud does not need the runner.
    if (machtype === 'CLOUD')
        return;

    if (machtype === 'FOG') 
        sock = cserv;
    else 
        sock = fserv;

    // No need to run startRunner.. if the device is not connected to the fog..
    // Or the fog is not connected to the cloud..
    if (sock === undefined)
        return;

    console.log("Starting the runner (downflow manager) ..");
    sock.on('connect', function() {
        sock.subscribe('/mach/func/request');
    });
    sock.on('reconnect', function() {
        sock.subscribe('/mach/func/request');
    });

    sock.on('message', function(topic, buf) {

        console.log("Recv..");
        cbor.decodeFirst(buf, function(error, msg) {
            switch (topic) {
                case '/mach/func/request':
                // Requests flowing downwards. 
                    try {
                        console.log("Calling mach Runner.......", msg);
                        machRunner(msg);
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;
            }
        });
    });
}


// =============================================================================
// Internal service routines. These are major routines that implement key 
// functions of the JAM module. 
// =============================================================================


function machRunner(msg) {

    console.log("machRunner - received: ", msg);
    switch (msg['cmd']) {
        case 'MEXEC-ASY':
            if (machtype === 'DEVICE') {
                msg['cmd'] = 'MEXEC-ACK';
                fserv.publish('/mach/func/reply', cbor.encode(msg));
                
                // Execute the function..
                eval(msg.actname)(msg.args);
            } 
            else 
            {
                insertRunTable(msg["actid"], function(status) {
                    if (status === 'ACK') {
                        msg['cmd'] = 'MEXEC-ACK';
                        cserv.publish('/mach/func/reply', cbor.encode(msg));
                        
                        // Execute the function..
                        eval(msg.actname)(msg.args);
                    }
                });

                mserv.publish('/mach/func/request', cbor.encode(msg));
            }

        break;

        default:
        break;
    }
}


// The machine service handler..
// Used to process messages bubbling upwards... lets treat one message type at a time
// Only one message is going upwards from a subtree..
//
function machAsyncService(msg, callback) {

    // Take action: remove from runTable on ACK .. 
    console.log("machService - received: ", msg);
    switch (msg['cmd']) {
        case 'MEXEC-ACK':
        case 'REXEC-ACK':
        
            var runid = msg['actid'];
            if (runTable[runid] !== undefined) {
                var callback = runTable[runid];
                delete(runTable[runid]);
                callback("ACK");
            }
        break;
    }
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

    console.log("msg received: ", msg);
    switch (msg['cmd']) {
        case 'REGISTER':
            console.log("Register message recvd..");
            rdevid = msg['actarg'];            
            msg['cmd'] = 'REGISTER-ACK';
            msg['actid'] = deviceParams.getItem('deviceId');
            if (devTable[rdevid] === undefined) {
                // Registration request is for a new device
                msg['opt'] = 'NEW';
                devTable[rdevid] = Date.now();
                callback(msg);
            }
            else
            {
                // Request for a devices already registered
                msg['opt'] = 'OLD';
                callback(msg);
            }
        break;
        case 'GET-CF-INFO':
            cloud = machRegistry.getTheCloud();
            console.log(cloud);
            if (cloud !== undefined)
                claddr = machRegistry.getURL(cloud);
            else
                claddr = undefined;
            fog = machRegistry.getAFog();
            console.log("Fog--->: ", fog);
            if (fog !== undefined)
                fgaddr = machRegistry.getURL(fog);
            else
                fgaddr = undefined;
            addresses = [];
            if (fgaddr !== undefined) {
                addresses.push(fgaddr);
                if (claddr !== undefined) 
                    addresses.push(claddr);
                // no cloud address without a fog address!
            }
            
            console.log("Addresses: ", addresses);
            msg['cmd'] = 'PUT-CF-INFO';
            msg['args'] = addresses;
            callback(msg);
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



// =============================================================================
// Callback routines. These routines are used in a reactive manner by the 
// services. They are majorly used to run functions to implement the remote 
// execution calls. 
// =============================================================================

// This function does the following..
// One success.. it calls the callback with the following message
// [[ REXEC-ACK - ACTIVITY actid device_id lease-value (arg0) ]]
// It fails on many conditions: function not found, condition not true,
// illegal parameters, etc. Sends the following message on failure
// [[ REXEC-NAK - ACTIVITY actid device_id error-code (arg0) ]]
//
function runSyncCallback(cmsg, callback) {

	var fentry = funcRegistry[cmsg["actname"]];
    console.log("Fentry: ", fentry, "actname ", cmsg["actname"]);
	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": machtype, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["NOT-FOUND"]};
		callback(nmsg);
	} 
    else
	if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": machtype, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["ILLEGAL-PARAMS"]};
		callback(nmsg);
		console.log("Sent the message..ILLEGAL-PARAMS");
	}
    else
    if (jcond.checkCondition(cmsg["opt"]) !== true) {
        // send an REXEC-NAK message: {REXEC-NAK SYN, ACTIVITY, actid, device_id, error_code}
        var nmsg = {"cmd": "REXEC-NAK", "opt": machtype, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["CONDITION-FALSE"]};
		callback(nmsg);
		console.log("Sent the message..CONDIITON FALSE");
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;

		var nmsg = {"cmd": "REXEC-ACK", "opt": machtype, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": cmsg["args"]};
        callback(nmsg);

		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);

		activityTable[cmsg["actid"]] = res;
		console.log("Execution complete.. results stored...");
	}
}


function runAsyncCallback(cmsg, callback) {

	var fentry = funcRegistry[cmsg["actname"]];
    console.log("Fentry: ", fentry, "actname ", cmsg["actname"]);

	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
	    var nmsg = {"cmd": "REXEC-NAK", "opt": machtype, "actname": cmsg["actname"],
		 "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["NOT-FOUND"]};
        callback(nmsg);
		console.log("Sent the message..NOT-FOUND");
	}
    else
    if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
		var nmsg = {"cmd": "REXEC-NAK", "opt": machtype, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["ILLEGAL-PARAMS"]};
		callback(nmsg);
		console.log("Sent the message..ILLEGAL-PARAMS");
	}
    else
    if (jcond.checkCondition(cmsg["opt"]) !== true) {
        // send an REXEC-NAK message: {REXEC-NAK ASY, ACTIVITY, actid, device_id, error_code}
        var nmsg = {"cmd": "REXEC-NAK", "opt": machtype, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": ["CONDITION-FALSE"]};
		callback(nmsg);
		console.log("Sent the message..CONDIITON FALSE");
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;

		var nmsg = {"cmd": "REXEC-ACK", "opt": machtype, "actname": cmsg["actname"], 
        "actid": cmsg["actid"], "actarg": cmsg["actarg"], "args": cmsg["args"]};
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
		nmsg = {"cmd": "REXEC-RES", "opt": "PUT", "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": "NOT-FOUND", "args": []};
	else
		nmsg = {"cmd": "REXEC-RES", "opt": "PUT", "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
    
    callback(nmsg);
}


// Define the machine runners
//


// =============================================================================
// Utility routines and components. These implement key functionalities that 
// are used by other routines.
// =============================================================================

function checkArgsType(args, mask) {
    
    if (args.length !== mask.length)
        return false;
    
    for (m in mask) {
        switch (mask[m]) {
            case 's':
                if (typeof(args[m]) !== 'string')
                    return false;
                break;
            case 'i':
                if (typeof(args[m]) !== 'number')
                    return false;
                break;
        }
    }
    return true;
}


function insertRunTable(runid, callback) {
    runTable[runid] = callback;     
}
 

function deleteRunTable(runid)
{
    delete(runTable[runid]);
}


//
// ============== TEMPORARY STUFF =============================
// ============== REMOVE QUICKLY  =============================
//

function hello(arg) {
	console.log("This is from the hello function.: ", arg);
}
