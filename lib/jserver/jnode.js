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
    deferredTable = [],    
    runTable = {};

var mserv = undefined;
var cserv = undefined;
var fserv = undefined;

var jcond;
var machtype = undefined;


module.exports = new function() {

    // Connect to the server.. we know the server is there..
    mserv = mqtt.connect("tcp://localhost:" + cmdopts.port);
    this.init = function (mtype) {
        machtype = mtype;
    }

    this.registerCallback = registerCallback;
    
    this.remoteSyncExec = remoteSyncExec;
    
    this.remoteAsyncExec = remoteAsyncExec;

    this.machAsyncExec = machAsyncExec; 

    this.machSyncExec = machSyncExec;
    
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


// This function needs to work differently based on whether clocked or unclocked
// mode is in use..

// With clocked mode, we expect many results because many devices are attached to the 
// J mode.

function remoteSyncExec(name, params, expr, vec, callback) {

    if (machtype == 'DEVICE') {
        // send out the execute to the C side..
        var tmsg = {"cmd": "REXEC-SYN", "opt": "SYN", "cond": expr, "condvec": vec, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        
        insertRunTable(runid, function(rstatus) {

            // Run the function after getting a successfull ACK
            if (rstatus.type == 'ACK') {
                delayTimeOut(runid);
            }
            else
            if (rstatus.type == 'RES') {
                callback(null, rstatus.value[0]);
            }
        });

        mserv.publish('/mach/func/request', cbor.encode(tmsg));

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
            callback(null, "XXXX Timed out...");
        }, 2000);
    }
    else 
    {   
        // send out the REXEC-INQ message to get the status of the execution..
        // TODO: What to do with the status?? At this point, nothing is done with it.
        var tmsg = {"cmd": "REXEC-SYN", "opt": "SYN", "cond": expr, "condvec": vec, "actname": name, "actid": "-", "actarg": "-", "args": params};
        // We get the same runid as the previous actual execution.. now change to REXEC-INQ
        tmsg.cmd = "REXEC-INQ";
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        insertRunTable(runid, function(rstatus) {
            // invoke the callback with the status..
            
            callback(null, rstatus); 
            deleteRunTable(runid);
        });

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
            callback(null, false);
        }, 300);
    }
}


function remoteAsyncExec(name, params, expr, vec, callback) {

    if (machtype == 'DEVICE') {
        // send out the execute to the C side..
        var tmsg = {"cmd": "REXEC-ASY", "opt": "ASY", "cond": expr, "condvec": vec,  "actname": name, "actid": "-", "actarg": "-", "args": params};
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
        var tmsg = {"cmd": "REXEC-ASY", "opt": "ASY", "cond": expr, "condvec": vec,  "actname": name, "actid": "-", "actarg": "-", "args": params};
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

        mserv.publish('/mach/func/request', cbor.encode(tmsg));

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
        }, 300);
    }
}


function machSyncExec(name, params, expr, vec, callback) {

    if (machtype === 'DEVICE') {

        var fentry = funcRegistry[name];
        if (fentry === undefined) {
            callback(null, "Function: " + name + "not found");
        }

        if (eval(expr)) {
            // run the function in variable 'name' locally.. it might trigger a remote call to C
            try {
                fentry.func.apply(this, params);
                callback(null, "Execution: " + name + " complete");
            } catch(e) {
                callback(null, "Error running: " + name);
            }
        }
        else 
            callback(null, "Error executing expr: " + expr);
    }
    else 
    {
        // Create the execution call.. message 
        var tmsg = {"cmd": "MEXEC-SYN", "opt": "SYN", "cond": expr, "condvec": vec, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        insertRunTable(runid, function(rstatus) {

            // Run the function after getting a successfull ACK
            if (rstatus == 'ACK') {

                var fentry = funcRegistry[name];
                if (fentry === undefined) {
                    callback(null, "Function: " + name + "not found");
                }
                fentry.func.apply(this, params);
                callback(null, "Execution: " + name + " complete");
            } else
                callback(null, "NAK received");
            // TODO: There could be bug here.. check here and in the Async version??
            deleteRunTable(runid);
        });

        // Publish it to the sub machine..
        var encode = cbor.encode(tmsg);
        mserv.publish('/mach/func/request', encode);

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds? 
        setTimeout(function () {
            deleteRunTable(runid);
            callback(null, "Timeout occured");
        }, 300);
    }
}



// Returns true if it is able to launch the specified function
// Returns false if it determines a failure..
//
function machAsyncExec(name, params, expr, vec) {

    // If the current node is device, just execute the function.
    if (machtype === 'DEVICE') {

        var fentry = funcRegistry[name];
        if (fentry === undefined) 
            return false;

        if (eval(expr)) {
            // run the function "name" locally.. it might trigger a remote call to C devices            
            try {
                fentry.func.apply(this, params);
                return true;
            } catch(e) {
                return false;
            }
        }
        else
            return false;
    }
    else 
    {
        // Create the execution call.. message 
        var tmsg = {"cmd": "MEXEC-ASY", "opt": "ASY", "cond": expr, "condvec": vec, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine 
        insertRunTable(runid, function(rstatus) {

            // Run the function after getting a successfull ACK
            if (rstatus == 'ACK') {
                var fentry = funcRegistry[name];
                if (fentry === undefined) 
                    return false;

                fentry.func.apply(null, params);
                return true;
            } else
                return false;
            deleteRunTable(runid);
        });

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
            url = machRegistry.getURL(fog);
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

    // TODO: Why??? Redefining again...?? 
    // TODO: Solve the mystery...
    // Can't figure this out..

    mserv = mqtt.connect("tcp://localhost:" + cmdopts.port);
    mserv.on('connect', function() {
        mserv.subscribe('/admin/request/all');
        mserv.subscribe('/level/func/request');    
        mserv.subscribe('/mach/func/reply');    

        // Send a ping every 500 milliseconds. This is needed so that the clients waiting at the
        // broker will know about a newly joining broker 
        //
        setInterval(function() {
            var tmsg = {"cmd": "PING", "opt": "BROKER", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []};
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
            var tmsg = {"cmd": "PING", "opt": "BROKER", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []};
            var encode = cbor.encode(tmsg);
            process.stdout.write(".");
            mserv.publish('/admin/announce/all', encode);
        }, 500);
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
                        machService(msg);
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

    sock.on('connect', function() {
        sock.subscribe('/mach/func/request');
    });
    sock.on('reconnect', function() {
        sock.subscribe('/mach/func/request');
    });

    sock.on('message', function(topic, buf) {

        cbor.decodeFirst(buf, function(error, msg) {
            switch (topic) {
                case '/mach/func/request':
                // Requests flowing downwards. 
                    try {
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

    switch (msg['cmd']) {
        case 'MEXEC-ASY':
            if (machtype === 'DEVICE') {
                msg['cmd'] = 'MEXEC-ACK';

                fserv.publish('/mach/func/reply', cbor.encode(msg));
                
                // Execute the function..
                var fentry = funcRegistry[msg.actname];
                if (fentry !== undefined) 
                    fentry.func.apply(null, msg.args);
            } 
            else 
            {
                // This is a fog node.. Request is going downwards.. 
                insertRunTable(msg["actid"], function(status) {
                    
                    // Executed when the request comes back up ..
                    if (status === 'ACK') {
                        msg['cmd'] = 'MEXEC-ACK';
                        cserv.publish('/mach/func/reply', cbor.encode(msg));
                        
                        // Execute the function..
                        var fentry = funcRegistry[msg.actname];
                        if (fentry !== undefined) 
                            fentry.func.apply(this, msg.args);
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
function machService(msg) {

    // Take action: remove from runTable on ACK .. 
    switch (msg['cmd']) {
        case 'MEXEC-ACK':
        case 'REXEC-ACK':        
            var runid = msg['actid'];
            if (runTable[runid] !== undefined) {
                var callback = runTable[runid];
                // Don't delete callback from runTable if it is SYNC
                if (msg['opt'] == 'ASY')
                    delete(runTable[runid]);
                callback({type: 'ACK', value: ''});
            }
        break;
        case 'REXEC-RES':
            var runid = msg['actid'];
            if (runTable[runid] !== undefined) {
                var callback = runTable[runid];
                delete(runTable[runid]);
                callback({type: 'RES', value: msg['args']});
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

    switch (msg['cmd']) {
        case 'REGISTER':
            rdevid = msg['actarg'];            
            msg['cmd'] = 'REGISTER-ACK';
            msg['actid'] = deviceParams.getItem('deviceId');
            if (devTable[rdevid] === undefined) {
                // Registration request is for a new device
                msg['opt'] = 'NEW';
                devTable[rdevid] = Date.now();
              //  console.log("Msg: ", msg);
                callback(msg);
            }
            else
            {
                // Request for a devices already registered
                msg['opt'] = 'OLD';
            //    console.log("Msg: ", msg);
                
                callback(msg);
            }
        break;
        case 'GET-CF-INFO':
            cloud = machRegistry.getTheCloud();
            if (cloud !== undefined)
                claddr = machRegistry.getURL(cloud);
            else
                claddr = undefined;
            fog = machRegistry.getAFog();
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
        case 'REXEC-RES-GET':
            // Get the results
            // TODO: Implement this one.
            getResults(msg, callback);
            break;
        case 'REXEC-ASY2':
            // Run the command in deferred mode
            runDeferredAsync(msg);
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
    var rmsg = cmsg;            // copy the incoming message to form the reply
    rmsg.opt = machtype;

	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, SYN, ACTIVITY, actid, device_id, error_code}
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["NOT-FOUND"];
		callback(rmsg);
	} 
    else
	if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["ILLEGAL-PARAMS"];
		callback(rmsg);
	}
    else
    if (jcond.checkCondition(cmsg["opt"]) !== true) {
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["CONDITION-FALSE"];
        callback(rmsg);
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;
        rmsg.cmd = "REXEC-ACK";
        callback(rmsg);

		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;
	}
}


function runAsyncCallback(cmsg, callback) {

	var fentry = funcRegistry[cmsg["actname"]];
    var rmsg = cmsg;
    rmsg.opt = machtype;

	if (fentry === undefined) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["NOT-FOUND"];
        callback(rmsg);
	}
    else
    if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["ILLEGAL-PARAMS"];
		callback(rmsg);
	}
    else
    if (jcond.checkCondition(cmsg["opt"]) !== true) {
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["CONDITION-FALSE"];
		callback(rmsg);
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
		activityTable[cmsg["actid"]] = undefined;
        rmsg.cmd = "REXEC-ACK";
        callback(rmsg);

		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;
	}
}


function getResults(cmsg, callback) {

	var nmsg,
		res = activityTable[cmsg["actid"]];

	if (res === undefined) 
		nmsg = {"cmd": "REXEC-RES-PUT", "opt": "-", "cond": "-", "condvec": 0, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": "NOT-FOUND", "args": []};
	else
		nmsg = {"cmd": "REXEC-RES-PUT", "opt": "-", "cond": "-", "condvec": 0, "actname": cmsg["actname"], 
		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
    
    callback(nmsg);
}


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

