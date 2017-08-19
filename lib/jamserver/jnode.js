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
var EventBus = require('./ebus');

var fogcache = require('./fogcache');

// Global variables for the module. I don't think these variable go into the
// global namespace.. so it is OK.

var devTable = {},
	funcRegistry = {},
	activityTable = {},
    runContext = [],
    runTable = new Map(),
    fogzones = [];

var mserv = undefined,
    cserv = undefined,
    fserv = undefined;

var fid = undefined,
    cid = undefined;

var jcond;
var machtype = undefined;
var reggie = undefined;
var ebus = undefined;


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
        ebus = new EventBus({fog: undefined, cloud: undefined});
    }

    this.registerCallback = registerCallback;
    this.remoteSyncExec = deasync(remoteSyncExec);
    this.remoteAsyncExec = remoteAsyncExec;
    this.machAsyncExec = machAsyncExec;
    this.machSyncExec = deasync(machSyncExec);
    this.startService = startService;
    this.startRunner = startRunner;
    this.doRegister = doRegister;
    this.jcondContext = jcondContext;
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

        // TODO: What should be the timeout value?``
        var tihandle = setTimeout(function () {
            deleteRunTable(runid);
            callback(null, "Timed out: " + runid);
        }, globals.Timeouts.J2C_DEVICE);

        // Changes
        // reset the resMap for the new sync exec.
        resMap = new Map();
        results = [];

        insertRunTable(runid, tmsg, '/mach/func/request', function(rstatus) {

            // Return the results when a RES type callback is received.
            // This comes from the machService...
            if (rstatus.type == 'RES') {
                callback(null, rstatus.value);
                clearTimeout(tihandle);
                deleteRunTable(runid);
            }
            else {
                delayTimeOut(tihandle, computeTimeout(runid));
            }
        });

    //    mserv.publish('/mach/func/request', cbor.encode(tmsg));
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

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            deleteRunTable(runid);
            callback(null, "Timed out: " + runid);
        }, globals.Timeouts.J2J_FOG);

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine
        insertRunTable(runid, tmsg, '/mach/func/request', function(rstatus) {
            // invoke the callback with the status..
            if (rstatus.type == 'RES') {
                callback(null, rstatus.value);
                clearTimeout(tihandle);
                deleteRunTable(runid);
            }
            else {
                delayTimeOut(tihandle, computeTimeout(runid));
            }
        });
    }
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
        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            deleteRunTable(runid);
        }, globals.Timeouts.J2C_DEVICE);

        // We have setup the runid so that other nodes can compute the same runid for the invocation

        // Insert entry in the runTable with a callback that deletes the entry at the first ACK
        // TODO: We could do different things here. Wait for certain number of ACKs to delete
        // Or.. give an extension on the deadline for deletion at each ACK.
        // There is nothing to execute locally...

        insertRunTable(runid, tmsg, '/mach/func/request', function(rstatus) {
            // rstatus here is not an object... unlike in the sync case
            if (rstatus == 'ACK') {
                deleteRunTable(runid);
                clearTimeout(tihandle);
            }
        });

        // mserv.publish('/mach/func/request', cbor.encode(tmsg));
        // Publishing is done inside the insertRunTable...
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

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            deleteRunTable(runid);
        }, globals.Timeouts.J2C_FOG);

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine
        insertRunTable(runid, tmsg, '/mach/func/request', function(rstatus) {
            // invoke the callback with the status..
            callback(rstatus);
            clearTimeout(tihandle);
            deleteRunTable(runid);
        });

        // mserv.publish('/mach/func/request', cbor.encode(tmsg));
        // Done inside the insertRunTable..
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
                var res = fentry.func.apply(this, params);
                callback(null, res);
            } catch(e) {
                callback(null, "Error running: " + name);
            }
        }
        // If the expr evaluates to False.. we don't do anything.
        // This is JConditional evaluating to false.
    }
    else
    {
        // Create the execution call.. message
        var tmsg = {"cmd": "MEXEC-SYN", "opt": "SYN", "cond": expr, "condvec": vec, "actname": name, "actid": "-", "actarg": "-", "args": params};
        var runid = crypto.createHash('md5').update(JSON.stringify(tmsg)).digest('hex');
        // set the actid to runid so we can find get the correct runTable entry at acknowledgment
        tmsg.actid = runid

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            deleteRunTable(runid);
            callback(null, "Timed out: " + runid);
        }, globals.Timeouts.J2J_FOG);

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine
        insertRunTable(runid, tmsg, '/mach/func/request', function(rstatus) {

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

            clearTimeout(tihandle);
            deleteRunTable(runid);
        });

        // Publishing done inside the insertRunTable...
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

        // Set timer to cancel the execution if no reply is received within the timeout value
        // TODO: How to set the timeout value?? Why 300 milliseconds?
        var tihandle = setTimeout(function () {
            deleteRunTable(runid);
        }, globals.Timeouts.J2J_FOG);

        // Insert entry in the runTable with a callback that executes the local function
        // We wait for the ACK from at least one submachine
        insertRunTable(runid, tmsg, '/mach/func/request', function(rstatus) {

            // Run the function after getting a successfull ACK
            if (rstatus == 'ACK') {
                var fentry = funcRegistry[name];
                if (fentry === undefined)
                    return false;

                fentry.func.apply(null, params);
                return true;
            } else
                return false;

            clearTimeout(tihandle);
            deleteRunTable(runid);
        });

    }
}


function doRegister() {

    // IMPORTANT:: in the cloud -- fserv and cserv are undefined.
    //
    if (machtype === globals.NodeType.DEVICE) {
        reggie.on('zoneinfo', function(id) {
            console.log("(doRegister) =================>>>>>>>>>>>> Zone found ", id);
            // Put id into know fogzones.
            if (fogzones.indexOf(id) < 0)
                fogzones.push(id);

            // We are still searching for a fog ..
            if (!fserv) {
                // Does the new fog help us?
                if (fogcache.isUp(id)) {
                    fid = id;
                    foginfo = fogcache.getinfo(fid);

                    fserv = mqtt.connect(getURL(foginfo.ip, foginfo.port));
                    console.log("Sending......... fog up...........", foginfo);
                    ebus.emitFogUp(fid, foginfo);
                }
            }
        });
        reggie.on('fog-up', function(id, info) {
            console.log('(doRegister) FOG UP: id: ' + id + ', ip: ' + info.ip + ', port: ' + info.port);
            // Always update the cache.
            fogcache.up(id, info);
            // If we are not connected.. then we see whether the new fog is going to help
            if (!fserv) {
                var findex = fogzones.indexOf(id);
                // The new fog is already one of the available fogzones.. so go ahead and connect.
                if (findex >= 0) {
                    fid = id;
                    foginfo = fogcache.getinfo(fid);

                    fserv = mqtt.connect(getURL(foginfo.ip, foginfo.port));
                    console.log("Sending......... fog up...........", foginfo);
                    ebus.emitFogUp(fid, foginfo);
                }
            }
        });

        reggie.on('fog-down', function(id) {
            console.log('(doRegister) FOG DOWN: id: ' + id);
            // Mark the fog as down in the cache
            fogcache.down(id);
            if (id == fid) {
                fid = undefined;
                fserv = undefined;
                console.log("Fog down....");
                ebus.emitFogDown(id);
            }
            // Check whether another fog can take over
            for (fogid in fogzones) {
                if (fogcache.isUp(fogid)) {
                    fid = fogid;
                    foginfo = fogcache.getinfo(fogid);

                    fserv = mqtt.connect(getURL(foginfo.ip, foginfo.port));
                    console.log("Sending......... fog up...........", foginfo);
                    ebus.emitFogUp(fid, foginfo);
                }
            }
        });

        reggie.on('cloud-up', function(id, info) {
            console.log("Sending cloud up.......................");
            ebus.emitCloudUp(id, info);
        });

        reggie.on('cloud-down', function(id) {
            console.log("Cloud down...");
            ebus.emitCloudDown(id);
        });
    }
    else
    if (machtype === globals.NodeType.FOG) {
        reggie.on('cloud-up', function(id, info) {
            console.log('(doRegister) CLOUD UP: id: ' + id + ', ip: ' + info.ip + ', port: ' + info.port);
            if (!cserv) {
                cid = id;
                cserv = mqtt.connect(getURL(info.ip, info.port));
            }
        });

        reggie.on('cloud-down', function(id) {
            console.log('(doRegister) CLOUD DOWN: id: ' + id);
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
    var IDmap = new Map();

    if (machtype === undefined) {
        console.log("ERROR! Machine type is not set; should be: device, fog, or cloud");
        process.exit(1);
    }

    copts = {will: {topic: "/admin/announce/all",
                    payload: cbor.encode({"cmd": "KILL", "opt": "ALL", "cond": "-", "condvec": 0, "actname": "-", "actid": "-", "actarg": "-", "args": []}),
                    qos: 1,
                    retain: 0}};

    jcond = require('./jcond');

    // TODO: Why??? Redefining again...??
    // TODO: Solve the mystery...
    // Can't figure this out..

    mserv = mqtt.connect("tcp://localhost:" + cmdopts.port, copts);
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
        }, 50000);

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
                        console.log("----------------------------------");
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
                            var now = new Date().getTime()/1000.0;
                            // the exact time that all C nodes should start their jobs
                            var now1 = now + 0.2;
                            var strNow = ''+ now1;
                            console.log (strNow);
                            mserv.publish('admin/request/Go', strNow);
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
                insertRunTable(msg["actid"], msg, '/mach/func/request', function(status) {

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

                // mserv.publish('/mach/func/request', cbor.encode(msg));
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
            if (runTable.get(runid) !== undefined) {
                var callback = runTable.get(runid);
                // Don't delete callback from runTable if it is SYNC
                if (msg['opt'] == 'ASY')
                    runTable.delete(runid);
                callback({type: 'ACK', value: ''});
            }
        break;
        case 'REXEC-RES':
            var runid = msg['actid'];
            if (runTable.get(runid) !== undefined) {

                var callback = runTable.get(runid);
                // console.log(msg);
                var si = resMap.size;

                resMap.set(msg['actarg'], msg['args'][0]);
                if (resMap.size > si) {
                    results.push(msg['args'][0]);
                }
                // Received results from all C nodes.
                if (resMap.size >= cNodeCount) {
                    runTable.delete(runid);
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
            console.log(">>>>>>>>>>>>>>>>>>   GET-CF........ received...");
            console.log(rdevid);
            // Check whether we have already registered the callbacks.
            // If we don't do this.. we will end up getting many callbacks to a C
            // node and it will go crazy!
            var drecord = devTable[rdevid];
            console.log(">>>>>>>>>>>>>>>>    ", drecord);
            if (drecord !== undefined && drecord.tag === "none") {
                drecord.tag = "registered";
            } else {
                console.log("Skipping callback registration.. ");
                break;
            }

            if (machtype === globals.NodeType.DEVICE) {
                msg['cmd'] = 'PUT-CF-INFO';

                console.log("==============================");
                ebus.on('fog-up', function(fogId, connInfo) {
                    console.log('(adminService) FOG UP: id: ' + fogId + ', ip: ' + connInfo.ip + ', port: ' + connInfo.port);
                    msg['opt'] = 'ADD';
                    msg['actarg'] = globals.NodeType.FOG;
                    msg['actid'] = fogId;
                    msg['args'] = [getURL(connInfo.ip, connInfo.port)];
                    callback(msg);
                });

                ebus.on('fog-down', function(id) {
                    console.log('(adminService) FOG DOWN: id: ' + id);
                    msg['opt'] = 'DEL';
                    msg['actarg'] = globals.NodeType.FOG;
                    msg['actid'] = id;
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

                ebus.on('cloud-down', function(id) {
                    console.log('(adminService) CLOUD DOWN: id: ' + id);
                    msg['opt'] = 'DEL';
                    msg['actarg'] = globals.NodeType.CLOUD;
                    msg['actid'] = id;
                    callback(msg);
                });

                ebus.trigger();

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
    if (checkCondition(cmsg["opt"]) !== true) {
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


function insertRunTable(runid, tmsg, topic, callback) {

    // Send the message out...
    mserv.publish(topic, cbor.encode(tmsg));

    // Insert into the table
    runTable.set(runid, {msg:tmsg, type: tmsg.opt, started:false, topic:topic, cback:callback, tick:1, thandle:null});

    // Set the Interval based timeout
    var tihandle = setInterval(processTimeout, globals.Timeout.RunTable, runid);

    // Insert the timeout handler into the entry
    runTable.get(runid).thandle = tihandle;
}


// At timeout run this function
function processTimeout(runid) {

    var rentry = runTable.get(runid);
    // No need to process further if the sync task has already started..
    if (rentry.type == 'SYN' && rentry.started)
        return;

    // Use a gaussian function with mean 8 and std 1.0
    var gfunc = gauss(8.0, 1.0);
    var coff = gfunc.cdf(tick);

    var rval = Random.real(0, 1.0);
    if (rval > coff)
        mserv.publish(rentry.topic, cbor.encode(rentry.msg));       // Publish the message
    rentry.tick++;
}

function deleteRunTable(runid) {

    var rentry = runTable.get(runid);
    clearInterval(rentry.tihandle);
    runTable.delete(runid);
}

function updateRTTicks() {

    for (var [key, val] of runTable) {
        if (val.tick > 0)
            val.tick = val.tick - 1;
        runTable.set(key, val);
    }
}

function syncTaskStarted(runid) {

    var rentry = runTable.get(runid);
    rentry.started = true;
    runTable.set(runid, rentry);
}

function jcondContext(clvar) {

    // It is not valid to include both __ and .
    if (clvar.includes('.') && clvar.includes('__'))
        return null;

    if (clvar.includes('.'))
        return eval(clvar);

    if (clvar.includes('__')) {
        var ops = clvar.split('__');
        if (ops[0] == 'avg')
            return compute_flow_avg(ops[1]);
        if (ops[0] == 'min')
            return compute_flow_min(ops[1]);
        if (ops[0] == 'max')
            return compute_flow_max(ops[1]);
    }

    return null;
}


function checkCondition(cond) {

    if (cond === "")
        return true;
        
    return eval(cond);
}
