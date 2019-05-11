'use strict';

const cache = require('./fifocache');
const globals = require('./constants').globals;
const cmdopts = require('./cmdparser');
const cbor = require('cbor');
const JAMP = require('./jamprotocol');
const jsys = require('./jamsys');

class JCoreDaemon {

    constructor(jc) {
        // Maintain only one instance of the JCoreDaemon.. for the system
        if (JCoreDaemon.this)
            return JCoreDaemon.this;
        JCoreDaemon.this = this;

        this.jcore = jc;
        this.machtype = jc.machtype;
        this.activityTable = new Map();
    }

    machRunner(sock, msg) {

        if (msg['cmd'] === 'MEXEC-ASY' || msg['cmd'] === 'MEXEC-SYN') {
            // We need to get the clock evaluated.
            // We delay the execution by 50ms if the broadcast is not here.
            if (validClock(msg['actarg']))
                this.machRunner2(sock, msg);
            else {
                setTimeout(function() {
                    // Second try.. discard message if not success
                    if (validClock(msg['actarg']))
                        this.machRunner2(sock, msg);
                }, 50);
            }
        }
    }

    machRunner2(sock, msg) {

        var fentry = this.jcore.funcRegistry.get(msg.actname);
        // We received this call for execution from another J node.
        // Most likely a cloud or fog node... need to evaluate whether
        // the execution needs to happen at the current level or deferred again.
        var mlevel = msg['condvec'] & 0b111;
        var eres = this.jcondEval(msg['cond']);
        var that = this;

        // Skip this if it a duplicate
        if (cache.duplicate(msg['actid'])) {
            if (eres)
                JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
            return;
        }

        switch (msg['cmd']) {

            case 'MEXEC-ASY':
                if ((eres && mlevel > 0) ||
                    (eres && mlevel === 1 && this.machtype === globals.NodeType.DEVICE)) {
                    // Execute the function.. we know the function is there!
                    JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
                    this.executeAsyncFunc(fentry, msg.args, true);
                }
                else
                {
                    if (eres) {
                        JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
                        this.executeAsyncFunc(fentry, msg.args, true);

                    }
                    var tihandle = setTimeout(function () {
                        that.jcore.runTable.delete(msg["actid"]);
                    }, globals.Timeouts.J2J_DEVICE);

                    // This is a fog node.. Request is going downwards..
                    this.jcore.runTable.insert(msg["actid"], msg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {

                        if (rstatus.type === 'ACK') {
                            JAMP.sendMachAcknowledge(sock, cmdopts.app, msg);
                            that.jcore.runTable.delete(msg.actid);
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
                    (eres && mlevel === 1 && this.machtype === globals.NodeType.DEVICE)) {
                    msg['cmd'] = 'MEXEC-ACK';

                    if (this.machtype === globals.NodeType.DEVICE && this.jcore.fserv !== undefined)
                        this.jcore.fserv.publish('/' + cmdopts.app + '/mach/func/reply', cbor.encode(msg));
                    if (this.machtype === globals.NodeType.FOG && this.jcore.cserv !== undefined)
                        this.jcore.cserv.publish('/' + cmdopts.app + '/mach/func/reply', cbor.encode(msg));

                    // We are not returning values from here.
                    // TODO: Should we return value? Use "executeSyncFunc"?
                    this.executeAsyncFunc(fentry, msg.args, true);

                }
                else

                {
                    // This is a fog node.. Request is going downwards..
                    this.jcore.runTable.insert(msg["actid"], msg, '/' + cmdopts.app + '/mach/func/request', function(status) {

                        // Executed when the request comes back up ..
                        if (status === 'ACK') {
                            msg['cmd'] = 'MEXEC-ACK';
                            this.jcore.cserv.publish('/' + cmdopts.app + '/mach/func/reply', cbor.encode(msg));

                            // We are not returning values from here.
                            // TODO: Should we return value? Use "executeSyncFunc"?
                            this.executeAsyncFunc(fentry, msg.args, eres);
                        }
                    });
                    setTimeout(function () {
                        that.jcore.runTable.delete(msg["actid"]);
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

    // Disable exception if there is a successful execution...
    executeAsyncFunc(fentry, params, eres) {

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

    // The machine service handler..
    // Used to process messages bubbling upwards... lets treat one message type at a time
    // Only one message is going upwards from a subtree..
    //
    machService(msg) {

        // Take action: remove from runTable on ACK ..
        switch (msg['cmd']) {
            case 'MEXEC-ACK':
            case 'REXEC-ACK':
                var runid = msg['actid'];
                var rentry = this.jcore.runTable.get(runid);
                if (rentry !== undefined) {
                    var callback = rentry.cback;
                    if (msg['opt'] === 'ASY')
                        callback({type: 'ACK', value: ''});
                }
            break;
            case 'REXEC-RES':
                var runid = msg['actid'];
                var rentry = this.jcore.runTable.get(runid);
                if (rentry !== undefined) {

                    var callback = rentry.cback;
                    // console.log(msg);
                    var si = this.jcore.resMap.size;

                    this.jcore.resMap.set(msg['actarg'], msg['args'][0]);
                    if (this.jcore.resMap.size > si) {
                        this.jcore.results.push(msg['args'][0]);
                    }
                    // Received results from all C nodes.
                    if (this.jcore.resMap.size >= this.jcore.cNodeCount) {
                        callback({type: 'RES', value: results});
                        // Reset the result array
                        this.jcore.results = [];
                        this.jcore.resMap.clear();
                    }
                }
            break;
        }
    }

    // The level service handler..
    //
    levelService(msg, callback) {

        // Skip this if it a duplicate
        if (cache.duplicate(msg['actid'])) {
            if (this.activityTable.get(msg['actid'])) {
                msg.cmd = "REXEC-ACK";
                callback(msg);
                return;
            }
        }

        switch (msg['cmd']) {
            case 'REXEC-SYN':

                // Check whether this node is the "Root" for the request.
                // It depends on both the request and the node itself
                if (msg['opt'] === 'RTE' && this.jcore.iamRoot(msg['condvec']))
                    this.runSyncCallbackRTE(msg, callback);
                else
                if (msg['opt'] === 'NRT' && !this.jcore.iamRoot(msg['condvec']))
                    this.runSyncCallbackNRT(msg, callback);
            break;
            case 'REXEC-ASY':
                // Processing: [[ REXEC-ASY condition-string/- actname actid device_id args ]]
                // Check the actname, return error if not found
                // Check condition string, return error if not true
                // Send positive ack in other cases
                this.runAsyncCallback(msg, callback);

            break;
            case 'REXEC-RES-GET':
                // Get the results
                // TODO: Implement this one.
                this.getResults(msg, callback);
                break;
            case 'REXEC-ASY2':
                // Run the command in deferred mode -- TODO: This is missing!!
                this.runDeferredAsync(msg);
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
    runSyncCallbackRTE(cmsg, callback) {

    	var fentry = this.jcore.funcRegistry.get(cmsg["actname"]);
        var rmsg = cmsg;            // copy the incoming message to form the reply
        rmsg.opt = this.machtype;

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
    		this.activityTable.set(cmsg["actid"], null);
            rmsg.cmd = "REXEC-ACK";
            callback(rmsg);

    		// Run function
    		var res = fentry.func.apply(this, cmsg["args"]);
    		this.activityTable.set(cmsg["actid"], res);

    	    nmsg = {"cmd": "REXEC-RES", "opt": this.machtype.toUpperCase(), "cond": "-", "condvec": 0, "actname": cmsg["actname"],
    		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};
            var encode = cbor.encode(nmsg);
            this.jcore.mserv.publish('/' + cmdopts.app + '/level/func/reply/' + nmsg["actarg"], encode);

    	}
    }

    runSyncCallbackNRT(cmsg, callback) {

    	var fentry = this.jcore.funcRegistry.get(cmsg["actname"]);
        var rmsg = cmsg;            // copy the incoming message to form the reply
        rmsg.opt = this.machtype;

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

    runAsyncCallback(cmsg, callback) {

    	var fentry = this.jcore.funcRegistry.get(cmsg["actname"]);
        var rmsg = cmsg;
        rmsg.opt = this.machtype;

    	if (fentry === undefined) {
    		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
            rmsg.cmd = "REXEC-NAK";
            rmsg.args = ["NOT-FOUND"];
            callback(rmsg);
    	} else if (checkArgsType(cmsg["args"], fentry.mask) !== true) {
    		// send an REXEC-NAK message: {REXEC-NAK, ASY, ACTIVITY, actid, device_id, error_code}
            rmsg.cmd = "REXEC-NAK";
            rmsg.args = ["ILLEGAL-PARAMS"];
    		callback(rmsg);
    	} else if (checkCondition(cmsg["cond"]) !== true) {
            rmsg.cmd = "REXEC-NAK";
            rmsg.args = ["CONDITION-FALSE"];
    		callback(rmsg);
        } else {
            this.activityTable.set(cmsg["actid"], "Started");
    		// send [REXEC-ACK ASY ACTIVITY actid device_id lease-value (arg0) ]
            rmsg.cmd = "REXEC-ACK";
            callback(rmsg);

    		// Run function
    		var res = fentry.func.apply(this, cmsg["args"]);
            this.activityTable.set(cmsg["actid"],  "Completed");
    	}
    }

    getResults(cmsg, callback) {

    	var nmsg,
    		res = this.activityTable.get(cmsg["actid"]);

    	if (res === undefined)
    		nmsg = {"cmd": "REXEC-RES-PUT", "opt": this.machtype.toUpperCase(), "cond": "-", "condvec": 0, "actname": cmsg["actname"],
    		"actid": cmsg["actid"], "actarg": "NOT-FOUND", "args": []};
    	else
    		nmsg = {"cmd": "REXEC-RES-PUT", "opt": this.machtype.toUpperCase(), "cond": "-", "condvec": 0, "actname": cmsg["actname"],
    		"actid": cmsg["actid"], "actarg": "RESULTS", "args": [res]};

        callback(nmsg);
    }


    jcondEval(cstr) {
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

}

// Check whether the current clock is greater than or
// equal to the received clock
//
function validClock(aarg) {

    // No clock in the message
    if (aarg === '-')
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


function checkArgsType(args, mask) {
    var m;

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


function checkCondition(cond) {

    if (cond === "")
        return true;
    var tstr = eval(cond);
    if (tstr === "")
        return true;

    return eval(tstr);
}


function jcondContext(clvar) {

    if (clvar.includes('.')) {
        return eval(clvar);
    }

    return null;
}



module.exports = JCoreDaemon;
