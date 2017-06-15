//===================================================================
// This is the main processor for J nodes.
// All types of processing are done here.
//===================================================================


var cbor = require('cbor'),
    crypto = require('crypto');


// Load some global modules
var mqtt = require('mqtt');
var deviceParams = require('./deviceparams');
var cmdParser = require('./cmdparser');
var cmdopts = cmdParser();
var deasync = require('deasync');
var globals = require('./constants').globals;

// Global variables for the module. I don't think these variable go into the
// global namespace.. so it is OK.

var devTable = {},
	funcRegistry = {},
	activityTable = {},
    runContext = [],
    runTable = {};

var mserv = undefined;
var cserv = undefined;
var fserv = undefined;
var fid = undefined;
var cid = undefined;

var jcond;
var machtype = undefined;
var reggie = undefined;

//Changes
// Maintain a count of how many C nodes are connected, each time a C node is connected, the count is increased by 1
// TODO: when a C node disconnects it should be decremented.
var cNodeCount = 0;
// A map that keeps track of how many C nodes how have returned result during a sync execution.
var resMap;
// The array that stores the results from C nodes doing the sync exection.
var results = [];

module.exports = new function() {

    // Connect to the server.. we know the server is there..
    mserv = mqtt.connect("tcp://localhost:" + cmdopts.port);
    this.init = function (reggie, mtype) {
        reggie = reggie;
        machtype = mtype;
    }

    this.registerCallback = registerCallback;

    this.remoteSyncExec = deasync(remoteSyncExec);

    this.remoteAsyncExec = remoteAsyncExec;

    this.machAsyncExec = machAsyncExec;

    this.machSyncExec = deasync(machSyncExec);

    this.startService = startService;
    this.startRunner = startRunner;
    this.doRegister = doRegister;
}


// =============================================================================
// Interface functions. These are exported by the module interface
// They are directly used to execute functions from the JAMScript user program
// =============================================================================

function registerCallback(name, fk, mask) {

    if (name === "" || name === undefined) {
        console.log("Anonymous functions cannot be callbacks... request ignored");
        return;
    }

    if (funcRegistry[name] !== undefined) {
        console.log("Duplicate registration: " + name + ".. overwritten.");
    }

    funcRegistry[name] = {func: fk, mask:mask};
}


// This function needs to work differently based on whether clocked or unclocked
// mode is in use..

// With clocked mode, we expect many results because many devices are attached to the
// J mode.

function remoteSyncExec(name, params, expr, vec, callback) {

    console.log("Remote sync execution....");

    if (machtype == globals.NodeType.DEVICE) {
        // send out the execute to the C side..
        var tmsg = {"cmd": "REXEC-SYN", "opt": "SYN", "cond": expr, "condvec": vec, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');

        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine


        insertRunTable(runid, function(rstatus) {

            console.log("-------------------- status...", rstatus);

            // Run the function after getting a successfull ACK
            if (rstatus.type == 'RES') {
                callback(null, rstatus.value);
       //         callback(null, 10);
            }
            else {
                delayTimeOut(runid);
            }
        });

        // Changes
        // reset the resMap for the new sync exec.
        resMap = new Map();


        console.log("... Publish.......", tmsg);
        mserv.publish('/mach/func/request', cbor.encode(tmsg));

//        mserv.publish('admin/request/syncTimer', '1');

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        setTimeout(function () {
            deleteRunTable(runid);
            callback(null, "XXXX Timed out...");
        }, 200000);
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

    if (machtype == globals.NodeType.DEVICE) {
        // Make the command to send out..
        var tmsg = {"cmd": "REXEC-ASY", "opt": "ASY", "cond": expr, "condvec": vec,  "actname": name, "actid": "-", "actarg": "-", "args": params};
        // Compute the runid before we may mangle the command for different conditions
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid

        // check runContext.
        // if a runContext exists, we are running a callback.. so we need to trigger the node that made the
        // original call
        curctx = runContext[runContext.length -1];
        if (curctx !== undefined) {
            tmsg.cmd = "REXEC-ASY-CBK";
            tmsg.actarg = curctx;
        }

        // We have setup the runid so that other nodes can compute the same runid for the invocation

        // Insert entry in the runTable with a callback that deletes the entry at the first ACK
        // TODO: We could do different things here. Wait for certain number of ACKs to delete
        // Or.. give an extension on the deadline for deletion at each ACK.
        // There is nothing to execute locally...

        insertRunTable(runid, function(rstatus) {

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

    if (machtype === globals.NodeType.DEVICE) {

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
    if (machtype === globals.NodeType.DEVICE) {

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
    if (machtype === globals.NodeType.DEVICE) {
        reggie.on('fog-up', function(id, info) {
            if (!fserv) {
                fid = id;
                fserv = mqtt.connect(getURL(info.ip, info.port));
            }
        });

        reggie.on('fog-down', function(id) {
            if (id == fid) {
                fid = undefined;
                fserv = undefined;
            }
        });
    }
    else
    if (machtype === globals.NodeType.FOG) {
        reggie.on('cloud-up', function(id, info) {
            if (!cserv) {
                cid = id;
                cserv = mqtt.connect(getURL(info.ip, info.port));
            }
        });

        reggie.on('cloud-down', function(id) {
            if (id == cid) {
                cid = undefined;
                cserv = undefined;
            }
        });
    }

    // kick-start registration and discovery
    reggie.registerAndDiscover();
}


function startService() {

    // Changes
    var syncCount = 0;
    var IDmap = new Map();

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
        // Changes
        mserv.subscribe('admin/request/syncTimer');

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
        // Changes
        mserv.subscribe('admin/request/syncTimer');

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

                // Changes
                case 'admin/request/syncTimer' :
                    try {
                       // adminService(msg, function(rmsg) {
                        console.log(msg);
                        // Use the map to record the different nodes that are ready
                        IDmap.set(msg.actid, 1);
                        // All of the nodes are ready
                        if (IDmap.size >= cNodeCount) {
                            console.log("PUBBBBBBLLLLLISH");
                            var now = new Date().getTime()/1000.0;
                            // the exact time that all C nodes should start their jobs
                            var now1 = now + 12.0;
                            var strNow = ''+ now1;
                            console.log (strNow);
                            mserv.publish('admin/request/Go', strNow);
                            IDmap.clear();
                        }

                       // });
                    } catch(e) {
                        console.log("ERROR!: ", e);
                    }
                    /*
                    syncCount++;
                    if (syncCount >= 2) {
                        // mserv.publish('admin/request/syncTimer', '1');
                        syncCount = 0;
                    }
                    */

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
    if (machtype === globals.NodeType.CLOUD)
        return;

    if (machtype === globals.NodeType.FOG)
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
            if (machtype === globals.NodeType.DEVICE) {
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
                console.log(msg);

                results.push(msg['args'][0]);
                // Received results from all C nodes.
                if (results.length >= cNodeCount) {
                    delete(runTable[runid]);
                    callback({type: 'RES', value: results});
                    // Reset the result array
                    results = [];
                }


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
            // Changes
            cNodeCount++;
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
            if (machtype === globals.NodeType.DEVICE) {
                msg['cmd'] = 'PUT-CF-INFO';

                reggie.discoverAttributes({
                    cloud: {
                        status: {
                            online: 'cloud-up',
                            offline: 'cloud-down'
                        }
                    }
                });

                reggie.on('fog-up', function(fogId, connInfo) {
                    msg['opt'] = 'ADD';
                    msg['actarg'] = globals.NodeType.FOG;
                    msg['actid'] = fogId;
                    msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                    callback(msg);
                });

                reggie.on('fog-down', function(fogId) {
                    msg['opt'] = 'DEL';
                    msg['actarg'] = globals.NodeType.FOG;
                    msg['actid'] = fogId;
                    callback(msg);
                });

                reggie.on('cloud-up', function(cloudId, connInfo) {
                    msg['opt'] = 'ADD';
                    msg['actarg'] = globals.NodeType.CLOUD;
                    msg['actid'] = cloudId;
                    msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                    callback(msg);
                });

                reggie.on('cloud-down', function(cloudId) {
                    msg['opt'] = 'DEL';
                    msg['actarg'] = globals.NodeType.CLOUD;
                    msg['actid'] = cloudId;
                    callback(msg);
                });

                // kick-start registration and discovery
                reggie.registerAndDiscover();
            }
        break;
        default:
            console.log('AdminService:: UNKNOWN CMD: ' + msg['cmd'] + ' received.. ');
            throw('UNKNOWN COMMAND');
    }

}

function getURL(ip, port) {
    return "tcp://" + ip + ":" + port;
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

        console.log("In method..");
		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
		activityTable[cmsg["actid"]] = res;

	    nmsg = {"cmd": "REXEC-RES", "opt": "-", "cond": "-", "condvec": 0, "actname": cmsg["actname"],
		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
        var encode = cbor.encode(nmsg);
        mserv.publish('/level/func/reply/' + nmsg["actarg"], encode);

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

        // Push context
        runContext.push(cmsg["actid"]);
		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
        // Pop the context
        runContext.pop();
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
