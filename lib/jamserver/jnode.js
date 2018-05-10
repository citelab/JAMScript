//===================================================================
// This is the main processor for J nodes.
// All types of processing are done here.
//===================================================================



// WARNING! Dangerous code ahead...
// This needs some careful restructuring.. perhaps using a class structure..
// For now, we will get by with this code!


var cbor = require('cbor');


var random = undefined,
    gfunc = undefined;

// Load some global modules
var mqtt = require('mqtt');
var deviceParams = require('./deviceparams');
var cmdopts = require('./cmdparser');
var deasync = require('deasync');
var globals = require('./constants').globals;
var mqttconsts = require('./constants').mqtt;
var ebus = require('./ebus');
var cache = require('./fifocache');
var NodeCache = require('./nodecache');
var JAMLogger = require('./jamlogger');
var RunTable = require('./runtable');
var JAMP = require('./jamprotocol');

// Global variables for the module. I don't think these variable go into the
// global namespace.. so it is OK.

var devTable = {},
	funcRegistry = {},
	activityTable = {},
    runContext = [],
    runTable,
    fogzones = [],
    runLevel = [],
    ncache;

var bc = {},
    lgg = {},
    fl = {};

var mserv = undefined,
    cserv = undefined,
    fserv = undefined;

var fid,
    cid;

var machtype,
    reggie;

var jcond = new Map();
var sys = require('./jamsys');

var acount = 1,
    scount = 1;

//Changes
// Maintain a count of how many C nodes are connected, each time a C node is connected, the count is increased by 1
// TODO: when a C node disconnects it should be decremented.
var cNodeCount = 0;
// A map that keeps track of how many C nodes how have returned result during a sync execution.
var resMap;
// The array that stores the results from C nodes doing the sync exection.
var results = [];

module.exports = new function() {

    // TODO: Do we need to setup a connection to the server here?
    // Earlier there was an mqtt.connect() here. We have that in startService()
    this.init = function (reg, mtype) {
        reggie = reg;
        machtype = mtype;
        // Initialize the nodeCache. This cache keeps track of the known fogs and clouds.
        // Initial selection takes place at 100 milliseconds and the delay keeps doubling until reaching 2000
        if (ncache === undefined) {
            ncache = new NodeCache(200, 2, 2000);
        }
    }

    this.registerCallback = registerCallback;
    this.remoteSyncExec = deasync(remoteSyncExec);
    this.remoteAsyncExec = remoteAsyncExec;
    this.remoteAsyncExecCB = remoteAsyncExecCB;
    this.machAsyncExec = machAsyncExec;
    this.machSyncExec = deasync(machSyncExec);
    this.startService = startService;
    this.startRunner = startRunner;
    this.doRegister = doRegister;
    this.jcondContext = jcondContext;
    this.jcond = jcond;
    this.ncache = getNcache;
    this.poplevel = popLevel;
    this.addBroadcaster = addBroadcaster;
    this.addLogger = addLogger;
    this.addFlow = addFlow;
}


// =============================================================================
// Interface functions. These are exported by the module interface
// They are directly used to execute functions from the JAMScript user program
// =============================================================================

function getNcache() {
    if (ncache === undefined) {
        ncache = new NodeCache(200, 2, 2000);
    }
    return ncache;
}


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


// We launch the remote execution from the curlevel. Set by a prior condition statement
// If none, then we are launching from a device level.
// Any level higher than the launching level

function remoteSyncExec(name, params, expr, vec, bcasters, cback, callback) {

    // Get the maximum of the broadcaster clocks
    var bclock = getMaxBcastClock(bcasters);
    if (bclock === null)
        return;

    var mlevel = curLevel();
    // Global counter to track synchronous remote invocations
    scount++;

    if ((mlevel === undefined) ||
        (mlevel === 4 && machtype === globals.NodeType.CLOUD) ||
        (mlevel === 2 && machtype === globals.NodeType.FOG) ||
        (mlevel === 1 && machtype === globals.NodeType.DEVICE)) {


        var tmsg = JAMP.createRemoteSyncReq(name, params, expr, vec, machtype, bclock, scount);
        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine

        var tihandle = setTimeout(function () {
            runTable.delete(tmsg.actid);
            console.log("Timed out: " + tmsg.actid);
            callback(null, undefined);
        }, globals.Timeouts.J2C_DEVICE);

        // Changes
        // reset the resMap for the new sync exec.
        resMap = new Map();
        results = [];

        runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {

            // Return the results when a RES type callback is received.
            // This comes from the machService...
            if (rstatus.type == 'RES') {
                callback(null, rstatus.value);
                clearTimeout(tihandle);
                runTable.delete(tmsg.actid);
            }
            else {
                delayTimeout(tihandle, computeTimeout(tmsg.actid));
            }
        });
    }
    else
    {
        console.log("Sending INQ to the C side.........");

        // send out the REXEC-INQ message to get the status of the execution..
        // TODO: What to do with the status?? At this point, nothing is done with it.
        var tmsg = JAMP.createRemoteSyncReqQ(name, params, expr, vec, machtype, bclock, scount);

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            runTable.delete(tmsg.actid);
            callback(null, "Timed out: " + tmsg.actid);
        }, globals.Timeouts.J2J_FOG);

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine
        runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {
            // invoke the callback with the status..
            if (rstatus.type == 'RES') {
                callback(null, rstatus.value);
                clearTimeout(tihandle);
                runTable.delete(tmsg.actid);
            }
            else {
                delayTimeout(tihandle, computeTimeout(tmsg.actid));
            }
        });
    }
}


// Disable exception if there is a successful execution...
function executeAsyncFunc(fentry, params, eres) {

    if (eres) {
        try {
            fentry.func.apply(null, params);
            return true;
        } catch(e) {
            // The function caused an exception...
            return false;
        }
    } else
        return false;
}


function delayTimeout(q, tval) {
    setTimeout(q._onTimeout, tval);
    clearTimeout(q);
}


// TODO: We need to compute the timeout value for
// the task.. may be based on previous executions
// This value is set after the initial handshake.
function computeTimeout(runid) {

    // TODO: For now we return an arbitrary value
    return 2000;
}


function remoteAsyncExec(name, params, expr, vec, bcasters, cback, callback) {
    doRemoteAsyncExec(name, params, expr, vec, false, bcasters, cback, callback);
}


function remoteAsyncExecCB(name, params, expr, vec, bcasters, cback, callback) {
    doRemoteAsyncExec(name, params, expr, vec, true, bcasters, cback, callback);
}


function doRemoteAsyncExec(name, params, expr, vec, cbmode, bcasters, cb, callback) {

    // Get the maximum of the broadcaster clocks
    var bclock = getMaxBcastClock(bcasters);
    if (bclock === null)
        return;

    var cback = eval(cb);

    var mlevel = curLevel();
    // Global counter to track the asynchronous remote invocations
    acount++;

    if ((mlevel === undefined) ||
        (mlevel === 4 && machtype === globals.NodeType.CLOUD) ||
        (mlevel === 2 && machtype === globals.NodeType.FOG) ||
        (mlevel === 1 && machtype === globals.NodeType.DEVICE)) {

        // Make the command to send out..
        var tmsg = JAMP.createRemoteAsyncReq(name, params, expr, vec, machtype, bclock, acount);

        // if callback mode is enabled (running callback) - check runContext.
        // if a runContext exists, we found the original call and reply to it.
        // Otherwise, we use the normal call.. but we post a warning because
        // a callback should have a runcontext.
        //
        if (cbmode) {
            curctx = runContext[runContext.length -1];
            if (curctx !== undefined) {
                tmsg.cmd = "REXEC-ASY-CBK";
                tmsg.actarg = curctx;
            } else
                console.log("ERROR!! Context not found for callback..");
        }

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            runTable.delete(tmsg.actid);
            if (cback != null && cback != '')
                cback(params);
        }, globals.Timeouts.J2C_DEVICE);

        // Insert entry in the runTable with a callback that deletes the entry at the first ACK
        // TODO: We could do different things here. Wait for certain number of ACKs to delete
        // Or.. give an extension on the deadline for deletion at each ACK.
        // There is nothing to execute locally...

        runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {
            // rstatus here is not an object... unlike in the sync case
            if (rstatus.type == 'ACK') {
                runTable.delete(tmsg.actid);
                clearTimeout(tihandle);
            }
        });

    }

    // NOTE: the else part for the above 'if' is not needed.
    // We broadcast to the C only if this is the last level. Otherwise, some other J node
    // downtree would broadcast to the C nodes. We don't need to send the message to those
    // J nodes because those J nodes are going to going to run the block anyways.

    // The situation is different in the synchronous case as implemented below
}


function machSyncExec(name, params, oexpr, vec, bcasters, cb, callback) {

    var cback = eval(cb);

    // Check if the function is already registered or not.
    // We cannot execute an unknown function!
    var fentry = funcRegistry[name];
    if (fentry === undefined) {
        console.log("Function not found: " + name);
        callback(null, fentry);
    }

    // Get the maximum of the broadcaster clocks
    var bclock = getMaxBcastClock(bcasters);
    if (bclock === null)
        return;

    // Get the level of access..
    var mlevel = 0b111 & vec;
    pushLevel(mlevel);
    var eres = jcondEval(oexpr);

    // We execute the sync call only if this is the last feasible level for execution
    // Or, no level is specified and we are at a device.
    // In both cases, the 'expr' should be true.

    if ((mlevel === 1 && machtype === globals.NodeType.DEVICE) ||
        (mlevel === 2 && machtype === globals.NodeType.FOG) ||
        (mlevel === 4 && machtype === globals.NodeType.CLOUD)) {

        // Return undefined if the JConditional evaluates to false
        // This can only happen if we have additional conditions besides the level enforcement
        if (!eres) {
            console.log("Condition false: " + name);
            callback(null, undefined);
        }

        // Now, run the function.. and get it return values
        try {
            var res = fentry.func.apply(this, params);
            callback(null, res);
        } catch(e) {
            console.log("Execution error: " + name);
            callback(null, undefined);
        }
    }
    else
    {
        // Create the execution call.. message
        var tmsg = createMachSyncReq(name, params, oexpr, vec, machtype, bclock);

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            runTable.delete(tmsg.actid);
            if (cback != null && cback != '')
                cback(params);
            console.log("Timed out: " + tmsg.actid);
            callback(null, undefined);
        }, globals.Timeouts.J2J_FOG);

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine
        runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app +'/mach/func/request', function(rstatus) {

            // Remove the entry and stop resending the request at first start..
            clearTimeout(tihandle);
            runTable.delete(tmsg.actid);
        });

        // Run the function at this node if the Condition is true
        if (eres) {
            try {
                var res = fentry.func.apply(this, params);
                callback(null, res);
            } catch(e) {
                console.log("Execution error: " + name);
                callback(null, undefined);
            }
        }
    }
}

// Returns true if it is able to launch the specified function
// Returns false if it determines a failure..
//
function machAsyncExec(name, params, oexpr, vec, bcasters, cb) {

    var cback = eval(cb);

    // Check if the function is already registered or not.
    // We cannot execute an unknown function!
    var fentry = funcRegistry[name];
    if (fentry === undefined)
        return false;

    // Get the maximum of the broadcaster clocks
    var bclock = getMaxBcastClock(bcasters);
    if (bclock === null)
        return;

    // Get the level of access..
    var mlevel = 0b111 & vec;
    var eres = jcondEval(oexpr);

    // We execute the async call only if this is the last feasible level for execution
    // Or, no level is specified and we are at a device.
    // In both cases, the 'expr' should be true.

    if ((mlevel === 1 && machtype === globals.NodeType.DEVICE) ||
        (mlevel === 2 && machtype === globals.NodeType.FOG) ||
        (mlevel === 4 && machtype === globals.NodeType.CLOUD)) {

        executeAsyncFunc(fentry, params, eres)
    }
    else
    {
        // No need to defer execution if we are already at the device level
        // Condition checking should not be here.. we defer even with false condition situation
        if (machtype !== globals.NodeType.DEVICE) {

            // Create the execution call.. message
            var tmsg = JAMP.createMachAsyncReq(name, params, oexpr, vec, machtype, bclock);

            // Now, we are going to try the execution downtree.. we are not expecting any return values
            // This is async. execution. For the set timeout value, we are repeatedly sending the request
            // according to the resending function. After that the request is taken out from the resend queue.
            // TODO: How to set the timeout value?? Right now.. it is hard coded in the 'constants' class.
            var tihandle = setTimeout(function () {
                var rentry = runTable.get(tmsg.actid);
                if (rentry.exception === true) {
                    if (cback != null && cback != '')
                        cback(params);
                }
                runTable.delete(tmsg.actid);
            }, globals.Timeouts.J2J_FOG);

            // Insert entry in the runTable with a null callback
            // We wait for the timeout to remove the entry. Until then the entry is going to
            // downcasted by the resending function..
            runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app +'/mach/func/request', function(rstatus) {
                if (rstatus.type == 'ACK') {
                    runTable.delete(tmsg.actid);
                    clearTimeout(tihandle);
                }
            });

            if (executeAsyncFunc(fentry, params, eres))
                runTable.offException(tmsg.actid);
        }
        else
            executeAsyncFunc(fentry, params, eres);
    }
}

function getMaxBcastClock(bstr) {

    var barr = [];
    var bcasters = eval(bstr);
    var bclock;
    bcasters.forEach(function(b) {
        var tclock = bc[b].getClock();
        barr.push(b);
        if (bclock === undefined || tclock > bclock)
            bclock = tclock;
    });

    if (bclock === undefined)
        return "-";
    else if (bclock !== null)
        return barr.join(',') + '|' + bclock;
    else
        return bclock;
}


function doRegister() {

    // Setup the callback handlers for NodeCache to work
    // Handler to run to connect to a fog
    ncache.onFogUp(function(id, info) {

        // fserv is not pointing to the current fog
        // it is undefined..
        if (fserv === undefined && id !== undefined && info !== undefined) {
            fid = id;
            console.log('--------------- Setting the fog...---------------');
            sys.setFog(fid);
            var furl = getURL(info.ip, info.port);
            fserv = mqtt.connect(furl);
            if (machtype === globals.NodeType.DEVICE)
                deviceParams.setItem('parentId', furl);
            ebus.emitFogUp(fid, info);
            runnerSockConfig(fserv);
            ncache.setCurrentFog(fid);
        }
    });

    // Handler to run to disconnect from a fog
    ncache.onFogDown(function(id, info) {

        // fserv is pointing to the current fog server
        if (fserv !== undefined && id !== undefined && info !== undefined) {
            fid = undefined;
            fserv.end(true);
            fserv = undefined;
            if (machtype === globals.NodeType.DEVICE)
                deviceParams.setItem('parentId', '-');
            console.log("Fog down....");
            ebus.emitFogDown(id, info);
            sys.unsetFog(id);
        }
    });

    // Hander to run to connect to a cloud
    ncache.onCloudUp(function(id, info) {

        // fserv is not pointing to the current fog
        // it is undefined..
        if (cserv === undefined && id !== undefined && info !== undefined) {
            cid = id;
            var curl = getURL(info.ip, info.port);
            cserv = mqtt.connect(curl);
            if (machtype === globals.NodeType.FOG)
                deviceParams.setItem('parentId', curl);
            ebus.emitCloudUp(cid, info);
            runnerSockConfig(cserv);
            sys.setCloud(cid);
            ncache.setCurrentCloud(cid);
        }
    });

    // Handler to run to disconnect from a cloud
    ncache.onCloudDown(function(id, info, callback) {

        // fserv is pointing to the current fog server
        if (cserv !== undefined && id !== undefined && info !== undefined) {
            cid = undefined;
            cserv.end(true);
            cserv = undefined;
            if (machtype === globals.NodeType.FOG)
                deviceParams.setItem('parentId', '-');
            console.log("Cloud down....");
            ebus.emitCloudDown(id, info);
            sys.unsetCloud(id);
        }
    });


    // Setup the reggie events - what the node does when advertisements come in
    //
    if (machtype === globals.NodeType.DEVICE) {
        reggie.on('fog-up', function(id, info) {
            console.log('(doRegister) FOG UP: id: ' + id + ', ip: ' + info.ip + ', port: ' + info.port);
            // Update the node cache... cache does the rest
            ncache.fogUp(id, info);
        });

        reggie.on('fog-down', function(id) {
            console.log('(doRegister) FOG DOWN: id: ' + id);
            // Mark the fog as down in the cache
            ncache.fogDown(id);
        });

        reggie.on('fog-datadepot-up', function(id, info) {
            ncache.fogDataUp(id, info);
        });

        reggie.on('cloud-up', function(id, info) {
            ncache.cloudUp(id, info);
        });

        reggie.on('cloud-down', function(id) {
            ncache.cloudDown(id);
        });
    }
    else
    if (machtype === globals.NodeType.FOG) {
        reggie.on('cloud-up', function(id, info) {
            console.log("Cloud...up received...");
            ncache.cloudUp(id, info);
        });

        reggie.on('cloud-datadepot-up', function(id, info) {
            ncache.cloudDataUp(id, info);
        });

        reggie.on('cloud-down', function(id) {
            ncache.cloudDown(id);
        });
    }

    // kick-start registration and discovery
    reggie.registerAndDiscover();
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
    runnerSockConfig(sock);
}


function runnerSockConfig(sock) {

    sock.on('connect', function() {
        sock.subscribe('/' + cmdopts.app + '/mach/func/request');
    });
    sock.on('reconnect', function() {
        sock.subscribe('/' + cmdopts.app +'/mach/func/request');
    });

    sock.on('message', function(topic, buf) {

        cbor.decodeFirst(buf, function(error, msg) {
            switch (topic) {
                case '/' + cmdopts.app + '/mach/func/request':
                // Requests flowing downwards.
                    try {
                        machRunner(sock, msg);
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


function machRunner(sock, msg) {


    if (msg['cmd'] == 'MEXEC-ASY' || msg['cmd'] == 'MEXEC-SYN') {

        // We need to get the clock evaluated.
        // We delay the execution by 50ms if the broadcast is not here.
        if (validClock(msg['actarg']))
            machRunner2(sock, msg);
        else {
            setTimeout(function() {
                // Second try.. discard message if not success
                if (validClock(msg['actarg']))
                    machRunner2(sock, msg);
            }, 50);
        }
    }
}


// Check whether the current clock is greater than or
// equal to the received clock
//
function validClock(aarg) {

    // No clock in the message
    if (aarg == '-')
        return true;

    var arr = aarg.split('|');

    var rclock = parseFloat(arr[1], 10);

    var barr = arr[0].split(',');
    var mclock = 0.0;
    barr.forEach(function(b) {
        var tclock = parseFloat(bc[b].getClock());
        if (tclock > mclock)
            mclock = tclock;
    });

    if (rclock <= mclock)
        return true;
    else
        return false;
}


function machRunner2(sock, msg) {

    var fentry = funcRegistry[msg.actname];
    // We received this call for execution from another J node.
    // Most likely a cloud or fog node... need to evaluate whether
    // the execution needs to happen at the current level or deferred again.
    var mlevel = msg['condvec'] & 0b111;
    var eres = jcondEval(msg['cond']);

    // Skip this if it a duplicate
    if (cache.duplicate(msg['actid'])) {
        if (eres)
            JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
        return;
    }

    switch (msg['cmd']) {
        case 'MEXEC-ASY':
            if ((eres && mlevel > 0) ||
                (eres && mlevel === 1 && machtype === globals.NodeType.DEVICE)) {
                // Execute the function.. we know the function is there!
                JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
                executeAsyncFunc(fentry, msg.args, true);
            }
            else
            {
                if (eres) {
                    JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
                    executeAsyncFunc(fentry, msg.args, true);

                }
                var tihandle = setTimeout(function () {
                    runTable.delete(msg["actid"]);
                }, globals.Timeouts.J2J_DEVICE);

                // This is a fog node.. Request is going downwards..
                runTable.insert(msg["actid"], msg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {

                    if (rstatus.type === 'ACK') {
                        JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
                        runTable.delete(msg.actid);
                        clearTimeout(tihandle);
                    }
                });
            }
        break;
        case 'MEXEC-SYN':
            // This synchronous execution does not send any results back.
            // This is meant for execution at the local node.
            // Note that this is continuing the machSyncExec() function.
            // So, we are just running the block at each node
            if ((eres && mlevel > 0) ||
                (eres && mlevel === 1 && machtype === globals.NodeType.DEVICE)) {
                msg['cmd'] = 'MEXEC-ACK';

                if (machtype === globals.NodeType.DEVICE && fserv !== undefined)
                    fserv.publish('/' + cmdopts.app + '/mach/func/reply', cbor.encode(msg));
                if (machtype === globals.NodeType.FOG && cserv !== undefined)
                    cserv.publish('/' + cmdopts.app + '/mach/func/reply', cbor.encode(msg));

                // We are not returning values from here.
                // TODO: Should we return value? Use "executeSyncFunc"?
                executeAsyncFunc(fentry, msg.args, true);

            }
            else

            {
                // This is a fog node.. Request is going downwards..
                runTable.insert(msg["actid"], msg, '/' + cmdopts.app + '/mach/func/request', function(status) {

                    // Executed when the request comes back up ..
                    if (status === 'ACK') {
                        msg['cmd'] = 'MEXEC-ACK';
                        cserv.publish('/' + cmdopts.app + '/mach/func/reply', cbor.encode(msg));

                        // We are not returning values from here.
                        // TODO: Should we return value? Use "executeSyncFunc"?
                        executeAsyncFunc(fentry, msg.args, eres);
                    }
                });
                setTimeout(function () {
                    runTable.delete(msg["actid"]);
                }, globals.Timeouts.J2J_DEVICE);
            }

        break;
        case 'REXEC-INQ':
            // If the runid is in the runtable
            //      If the entry is still Check whether runid is in the runTable.
            // If so, ack the request
            // If not, put the request into a wait list.. just an array of runid

        break;
        default:
        break;
    }
}




function startService() {

    // Changes
    var IDmap = new Map();

    if (machtype === undefined) {
        console.log("ERROR! Machine type is not set; should be: device, fog, or cloud");
        process.exit(1);
    }

    copts = {
                will: {topic: "/" + cmdopts.app + "/admin/announce/all",
                    payload: cbor.encode({"cmd": "KILL", "opt": "ALL", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []}),
                    qos: 1,
                    retain: 0},
                clientId: deviceParams.getItem('deviceId'),
                keepalive: mqttconsts.keepAlive,
                clean: false,
                connectTimeout: mqttconsts.connectionTimeout,
            };


    mserv = mqtt.connect("tcp://localhost:" + cmdopts.port, copts);
    // Setup the runTable
    runTable = new RunTable(mserv);

    mserv.on('connect', function() {
        mserv.subscribe('/' + cmdopts.app + '/admin/request/all');
        mserv.subscribe('/' + cmdopts.app + '/level/func/request');
        mserv.subscribe('/' + cmdopts.app + '/mach/func/reply');
        // Changes
        mserv.subscribe('/' + cmdopts.app + '/admin/request/synctimer');

        // Send a ping every 500 milliseconds. This is needed so that the clients waiting at the
        // broker will know about a newly joining broker
        //
        setInterval(function() {
            var tmsg = {"cmd": "PING", "opt": "BROKER", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []};
            var encode = cbor.encode(tmsg);
            // process.stdout.write(".");
            mserv.publish('/' + cmdopts.app +'/admin/announce/all', encode);
        }, 1000);

    });
    mserv.on('reconnect', function() {
        mserv.subscribe('/' + cmdopts.app + '/admin/request/all');
        mserv.subscribe('/' + cmdopts.app + '/level/func/request');
        mserv.subscribe('/' + cmdopts.app + '/mach/func/reply');
        // Changes
        mserv.subscribe('/' + cmdopts.app +'/admin/request/synctimer');

        // Send a ping every 500 milliseconds. This is needed so that the clients waiting at the
        // broker will know about a newly joining broker
        //
        setInterval(function() {
            var tmsg = {"cmd": "PING", "opt": "BROKER", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []};
            var encode = cbor.encode(tmsg);
            process.stdout.write(".");
            mserv.publish('/' + cmdopts.app + '/admin/announce/all', encode);
        }, 500);
    });

    mserv.on('message', function(topic, buf) {

        cbor.decodeFirst(buf, function(error, msg) {

            switch (topic) {
                case '/' + cmdopts.app + '/admin/request/all':
                // Requests are published here by nodes under this broker
                    try {
                        adminService(msg, function(rmsg) {
                            var encode = cbor.encode(rmsg);
                            mserv.publish('/' + cmdopts.app +'/admin/announce/all', encode);
                        });
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;

                case '/' + cmdopts.app + '/level/func/request':
                // These are requests by the C nodes under this broker
                // The requests are published from device and fog levels
                    try {
                        levelService(msg, function(rmsg) {
                            var encode = cbor.encode(rmsg);
                            mserv.publish('/' + cmdopts.app +'/level/func/reply/' + msg["actarg"], encode);
                        });
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;

                case '/' + cmdopts.app + '/mach/func/reply':
                // Replies are bubbling upwards. So these are publications
                // coming from submachines.
                    try {
                        machService(msg);
                    } catch (e) {
                        console.log("ERROR!: ", e);
                    }
                break;

                // Changes
                case '/' + cmdopts.app + '/admin/request/synctimer' :
                    console.log("Synctimer request received... ", cNodeCount);
                    try {
                       // adminService(msg, function(rmsg) {
                        //console.log(msg);
                        // Use the map to record the different nodes that are ready
                        IDmap.set(msg.actid, 1);
                        // All of the nodes are ready
                        if (IDmap.size >= cNodeCount) {
                            var now = new Date().getTime()/1000.0;
                            // the exact time that all C nodes should start their jobs
                            var now1 = now + 0.2;
                            var strNow = ''+ now1;
                            mserv.publish('/' + cmdopts.app + '/admin/request/go', strNow);
                            IDmap.clear();
                        }
                    } catch(e) {
                        console.log("ERROR!: ", e);
                    }

                break;

            }
        });
    });
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
            var rentry = runTable.get(runid);

            if (rentry !== undefined) {
                var callback = rentry.cback;
                if (msg['opt'] == 'ASY')
                    callback({type: 'ACK', value: ''});
            }
        break;
        case 'REXEC-RES':
            var runid = msg['actid'];
            var rentry = runTable.get(runid);
            if (rentry !== undefined) {

                var callback = rentry.cback;
                // console.log(msg);
                var si = resMap.size;

                resMap.set(msg['actarg'], msg['args'][0]);
                if (resMap.size > si) {
                    results.push(msg['args'][0]);
                }
                // Received results from all C nodes.
                if (resMap.size >= cNodeCount) {
//                    runTable.delete(runid);   -- not needed - delete done in the next step
                    callback({type: 'RES', value: results});
                    // Reset the result array
                    results = [];
                    resMap = new Map();
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
            var rdevid = msg['actarg'];
            msg['cmd'] = 'REGISTER-ACK';
            msg['actid'] = deviceParams.getItem('deviceId');
            // Changes
            cNodeCount++;
            if (devTable[rdevid] === undefined) {
                // Registration request is for a new device
                msg['opt'] = 'NEW';
                devTable[rdevid] = {time: Date.now(), tag: "none"};
                callback(msg);
            }
            else
            {
                // Request for a devices already registered
                msg['opt'] = 'OLD';
                callback(msg);
            }
        break;
        case 'REF-CF-INFO':
            var rdevid = msg['actarg'];
            var drecord = devTable[rdevid];
            if (drecord !== undefined && drecord.tag === "registered")
                ebus.trigger();
        break;
        case 'GET-CF-INFO':
            var rdevid = msg['actarg'];
            // Check whether we have already registered the callbacks.
            // If we don't do this.. we will end up getting many callbacks to a C
            // node and it will go crazy!
            var drecord = devTable[rdevid];
            if (drecord !== undefined && drecord.tag === "none") {
                drecord.tag = "registered";
            } else {
                break;
            }

            if (machtype === globals.NodeType.DEVICE) {
                msg['cmd'] = 'PUT-CF-INFO';

                ebus.on('fog-up', function(fogId, connInfo) {
                //    console.log('(adminService) FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
                    msg['opt'] = 'ADD';
                    msg['actarg'] = globals.NodeType.FOG;
                    msg['actid'] = fogId;
                    msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                    callback(msg);
                });
                ebus.on('fog-down', function(id, info) {
                //    console.log('(adminService) FOG DOWN: id: ' + id);
                    msg['opt'] = 'DEL';
                    msg['actarg'] = globals.NodeType.FOG;
                    msg['actid'] = id;
                    msg['args'] = [getURL(info.ip, info.port)];
                    callback(msg);
                });
                ebus.on('cloud-up', function(cloudId, connInfo) {
                    console.log('(adminService) CLOUD UP: id: ' + cloudId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
                    msg['opt'] = 'ADD';
                    msg['actarg'] = globals.NodeType.CLOUD;
                    msg['actid'] = cloudId;
                    msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                    callback(msg);
                });
                ebus.on('cloud-down', function(id, info) {
                    console.log('(adminService) CLOUD DOWN: id: ' + id);
                    msg['opt'] = 'DEL';
                    msg['actarg'] = globals.NodeType.CLOUD;
                    msg['actid'] = id;
                    msg['args'] = [getURL(info.ip, info.port)];
                    callback(msg);
                });
                ebus.on('data-up', function(dinfo) {
                    msg['opt'] = 'ADD';
                    msg['actarg'] = 'redis';
                    msg['actid'] = '-';
                    msg['args'] = [dinfo.host, dinfo.port];
                    callback(msg);
                });
                ebus.trigger();
                var rinfo = sys.getRedis();
                if (rinfo !== undefined) {
                    msg['opt'] = 'ADD';
                    msg['actarg'] = 'redis';
                    msg['actid'] = '-';
                    msg['args'] = [rinfo.host, rinfo.port];
                    callback(msg);
                }
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

    // Skip this if it a duplicate
    if (cache.duplicate(msg['actid'])) {
        if (activityTable[msg['actid']]) {
            msg.cmd = "REXEC-ACK";
            callback(msg);
            return;
        }
    }

    switch (msg['cmd']) {
        case 'REXEC-SYN':

            // Check whether this node is the "Root" for the request.
            // It depends on both the request and the node itself
            if (msg['opt'] == 'RTE' && iamRoot(msg['condvec']))
                runSyncCallbackRTE(msg, callback);
            else
            if (msg['opt'] == 'NRT' && !iamRoot(msg['condvec']))
                runSyncCallbackNRT(msg, callback);
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
function runSyncCallbackRTE(cmsg, callback) {

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
    if (checkCondition(cmsg["cond"]) !== true) {
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

	    nmsg = {"cmd": "REXEC-RES", "opt": machtype.toUpperCase(), "cond": "-", "condvec": 0, "actname": cmsg["actname"],
		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
        var encode = cbor.encode(nmsg);
        mserv.publish('/' + cmdopts.app + '/level/func/reply/' + nmsg["actarg"], encode);

	}
}

function runSyncCallbackNRT(cmsg, callback) {

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
    if (checkCondition(cmsg["cond"]) !== true) {
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["CONDITION-FALSE"];
        callback(rmsg);
    }
	else
	{
		// create actid, select lease-value, put entry in the activity table
		// send [REXEC-ACK SYN ACTIVITY actid device_id lease-value (arg0) ]
        rmsg.cmd = "REXEC-ACK";
        callback(rmsg);
		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
        // This is NOT a root.. so no result broadcast
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
    if (checkCondition(cmsg["cond"]) !== true) {
        rmsg.cmd = "REXEC-NAK";
        rmsg.args = ["CONDITION-FALSE"];
		callback(rmsg);
    }
	else
	{
        activityTable[cmsg["actid"]] = "Started";
		// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
        rmsg.cmd = "REXEC-ACK";
        callback(rmsg);

        // Push context
        runContext.push(cmsg["actid"]);
		// Run function
		var res = fentry.func.apply(this, cmsg["args"]);
        // Pop the context
        runContext.pop();
        activityTable[cmsg["actid"]] = "Completed";

	}
}


function getResults(cmsg, callback) {

	var nmsg,
		res = activityTable[cmsg["actid"]];

	if (res === undefined)
		nmsg = {"cmd": "REXEC-RES-PUT", "opt": machtype.toUpperCase(), "cond": "-", "condvec": 0, "actname": cmsg["actname"],
		"actid": cmsg["actid"], "actarg": "NOT-FOUND", "args": []};
	else
		nmsg = {"cmd": "REXEC-RES-PUT", "opt": machtype.toUpperCase(), "cond": "-", "condvec": 0, "actname": cmsg["actname"],
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


// Returns true if I am Root
function iamRoot(n) {

    switch (n & 0x7) {
        // JCond did not specify a level
        case 0:
        // Return true if I am cloud
        if (machtype == globals.NodeType.CLOUD)
            return true;
        // Return true if I am fog and no cloud
        if (machtype == globals.NodeType.FOG && cserv == undefined)
            return true;
        // Return true if I am device and no fog and no cloud
        if (machtype == globals.NodeType.DEVICE && cserv == undefined && fserv == undefined)
            return true;
        break;

        // JCond wants device
        case 1:
        if (machtype == globals.NodeType.DEVICE)
            return true;
        break;

        // JCond wants Fog
        case 2:
        if (machtype == globals.NodeType.FOG)
            return true;
        break;

        // JCond wants Cloud
        case 4:
        if (machtype == globals.NodeType.CLOUD)
            return true;
        break;
    }
    // Otherwise return false
    return false;
}


function jcondContext(clvar) {

    if (clvar.includes('.'))
        return eval(clvar);

    return null;
}

function jcondEval(cstr) {
    var rval;

    if (cstr.length === 0)
        return false;

    if (cstr.includes("&&") && cstr.includes("||")) {
        console.log("WARNING! Unsupported jcond condition. Use either && or ||.");
        return false;
    }

    if (cstr.includes("&&")) {
        var comps = cstr.split("&&");
        rval = true;
        comps.forEach(function(cexpr) {
            try {
                if (eval(eval(cexpr)) === false)
                    rval = false;
            } catch(e) {
                return false;
            }
        })
        return rval;
    }
    else if (cstr.includes("||")) {
        var comps = cstr.split("||");
        rval = false;
        comps.forEach(function(cexpr) {
            try {
                if (eval(eval(cexpr)) === true)
                    rval = true;
            } catch(e) {
                rval = false;
            }
        })
        return rval;
    }
    else
    {
        try {
            return eval(eval(cstr));
        } catch(e) {
            return false;
        }
    }
}


function checkCondition(cond) {

    if (cond === "")
        return true;
    var tstr = eval(cond);
    if (tstr === "")
        return true;

    return eval(tstr);
}


function popLevel() {
    runLevel.pop();
}

function pushLevel(level) {
    runLevel.push(level);
}

function curLevel() {
    var tl = runLevel[runLevel.length -1];
    return tl;
}

function addBroadcaster(name, obj) {
    bc[name] = obj;
}

function addLogger(name, obj) {
    lgg[name] = obj;
}

function addFlow(name, obj) {
    fl[name] = obj;
}
