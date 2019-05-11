'use strict';

//===================================================================
// This is the client side of the JAMCore.
// It is responsible for launching the execution calls to
// C nodes and other J nodes.
// The J node remote execution is uptree and downtree.
//===================================================================


const globals = require('./constants').globals;
const cmdopts = require('./cmdparser');
const JAMP = require('./jamprotocol');

class JCoreClient {

    constructor(jc) {
        // Only maintain a single instance of the JCoreClient
        if (JCoreClient.this)
            return JCoreClient.this;
        JCoreClient.this = this;

        this.jcore = jc;
        this.scount = 0;
        this.acount = 0;
        this.machtype = jc.machtype;
    }

    remoteSyncExec(name, params, expr, vec, bcasters, cback, callback) {

        // Get the maximum of the broadcaster clocks
        var bclock = this.jcore.getMaxBcastClock(bcasters);
        if (bclock === null)
            return;

        var mlevel = this.jcore.curLevel();
        // Global counter to track synchronous remote invocations
        this.scount++;

        if ((mlevel === undefined) ||
            (mlevel === 4 && this.machtype === globals.NodeType.CLOUD) ||
            (mlevel === 2 && this.machtype === globals.NodeType.FOG) ||
            (mlevel === 1 && this.machtype === globals.NodeType.DEVICE)) {

            var tmsg = JAMP.createRemoteSyncReq(name, params, expr, vec, this.machtype, bclock, this.scount);
            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine

            var tihandle = setTimeout(function () {
                this.jcore.runTable.delete(tmsg.actid);
                console.log("Timed out: " + tmsg.actid);
                callback(null, undefined);
            }, globals.Timeouts.J2C_DEVICE);

            // reset the resMap for the new sync exec.
            this.jcore.resMap.clear();
            this.jcore.results = [];

            this.jcore.runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {

                // Return the results when a RES type callback is received.
                // This comes from the machService...
                if (rstatus.type === 'RES') {
                    callback(null, rstatus.value);
                    clearTimeout(tihandle);
                    this.jcore.runTable.delete(tmsg.actid);
                }
                else {
                    this.delayTimeout(tihandle, this.computeTimeout(tmsg.actid));
                }
            });
        }
        else
        {
            console.log("Sending INQ to the C side.........");

            // send out the REXEC-INQ message to get the status of the execution..
            // TODO: What to do with the status?? At this point, nothing is done with it.
            var tmsg = JAMP.createRemoteSyncReqQ(name, params, expr, vec, this.machtype, bclock, this.scount);

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds?
            var tihandle = setTimeout(function () {
                this.jcore.runTable.delete(tmsg.actid);
                callback(null, "Timed out: " + tmsg.actid);
            }, globals.Timeouts.J2J_FOG);

            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine
            this.jcore.runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {
                // invoke the callback with the status..
                if (rstatus.type === 'RES') {
                    callback(null, rstatus.value);
                    clearTimeout(tihandle);
                    this.jcore.runTable.delete(tmsg.actid);
                }
                else {
                    this.delayTimeout(tihandle, this.computeTimeout(tmsg.actid));
                }
            });
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

    delayTimeout(q, tval) {
        setTimeout(q._onTimeout, tval);
        clearTimeout(q);
    }

    // TODO: We need to compute the timeout value for
    // the task.. may be based on previous executions
    // This value is set after the initial handshake.
    computeTimeout(runid) {
        // TODO: For now we return an arbitrary value
        return 2000;
    }

    remoteAsyncExec(name, params, expr, vec, bcasters, cback, callback) {

        var that = this;
        // Get the maximum of the broadcaster clocks
        var bclock = this.jcore.getMaxBcastClock(bcasters);
        if (bclock === null)
            return;

//        var cback = eval(cb);

        var mlevel = this.jcore.curLevel();
        // Global counter to track the asynchronous remote invocations
        this.acount++;

        if ((mlevel === undefined) ||
            (mlevel === 4 && this.machtype === globals.NodeType.CLOUD) ||
            (mlevel === 2 && this.machtype === globals.NodeType.FOG) ||
            (mlevel === 1 && this.machtype === globals.NodeType.DEVICE)) {

            // Make the command to send out..
            var tmsg = JAMP.createRemoteAsyncReq(name, params, expr, vec, this.jcore.machtype, bclock, this.acount);

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds?
            var tihandle = setTimeout(function () {
                that.jcore.runTable.delete(tmsg.actid);
            }, globals.Timeouts.J2C_DEVICE);

            // Insert entry in the runTable with a callback that deletes the entry at the first ACK
            // TODO: We could do different things here. Wait for certain number of ACKs to delete
            // Or.. give an extension on the deadline for deletion at each ACK.
            // There is nothing to execute locally...
            this.jcore.runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app + '/mach/func/request', function(rstatus) {
                // rstatus here is not an object... unlike in the sync case
                if (rstatus.type === 'ACK') {
                    that.jcore.runTable.delete(tmsg.actid);
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

    machSyncExec(name, params, oexpr, vec, bcasters, cb, callback) {

        var cback = eval(cb);

        // Check if the function is already registered or not.
        // We cannot execute an unknown function!
        var fentry = this.jcore.funcRegistry.get(name);
        if (fentry === undefined) {
            console.log("Function not found: " + name);
            callback(null, fentry);
        }

        // Get the maximum of the broadcaster clocks
        var bclock = this.jcore.getMaxBcastClock(bcasters);
        if (bclock === null)
            return;

        // Get the level of access..
        var mlevel = 0b111 & vec;
        this.jcore.pushLevel(mlevel);
        var eres = jcondEval(oexpr);


        // We execute the sync call only if this is the last feasible level for execution
        // Or, no level is specified and we are at a device.
        // In both cases, the 'expr' should be true.

        if ((mlevel === 1 && this.machtype === globals.NodeType.DEVICE) ||
            (mlevel === 2 && this.machtype === globals.NodeType.FOG) ||
            (mlevel === 4 && this.machtype === globals.NodeType.CLOUD)) {

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
            var tmsg = JAMP.createMachSyncReq(name, params, oexpr, vec, machtype, bclock);

            // Set timer to cancel the execution if no reply is received within the timeout value
            // TODO: How to set the timeout value?? Why 300 milliseconds?
            var tihandle = setTimeout(function () {
                this.jcore.runTable.delete(tmsg.actid);
                console.log("Timed out: " + tmsg.actid);
                callback(null, undefined);
            }, globals.Timeouts.J2J_FOG);

            // Insert entry in the runTable with a callback that executes the local function
            // We wait for the ACK from at least one submachine
            this.jcore.runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app +'/mach/func/request', function(rstatus) {

                // Remove the entry and stop resending the request at first start..
                clearTimeout(tihandle);
                this.jcore.runTable.delete(tmsg.actid);
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
    machAsyncExec(name, params, oexpr, vec, bcasters, cb) {


        var cback = eval(cb);
        var that = this;

        // Check if the function is already registered or not.
        // We cannot execute an unknown function!
        var fentry = this.jcore.funcRegistry.get(name);
        if (fentry === undefined)
            return false;

        // Get the maximum of the broadcaster clocks
        var bclock = this.jcore.getMaxBcastClock(bcasters);
        if (bclock === null)
            return;

        // Get the level of access..
        var mlevel = 0b111 & vec;
        var eres = jcondEval(oexpr);


        // We execute the async call only if this is the last feasible level for execution
        // Or, no level is specified and we are at a device.
        // In both cases, the 'expr' should be true.

        if ((mlevel === 1 && this.machtype === globals.NodeType.DEVICE) ||
            (mlevel === 2 && this.machtype === globals.NodeType.FOG) ||
            (mlevel === 4 && this.machtype === globals.NodeType.CLOUD)) {

            this.executeAsyncFunc(fentry, params, eres)
        }
        else
        {
            // No need to defer execution if we are already at the device level
            // Condition checking should not be here.. we defer even with false condition situation
            if (this.machtype !== globals.NodeType.DEVICE) {

                // Create the execution call.. message
                var tmsg = JAMP.createMachAsyncReq(name, params, oexpr, vec, this.machtype, bclock);

                // Now, we are going to try the execution downtree.. we are not expecting any return values
                // This is async. execution. For the set timeout value, we are repeatedly sending the request
                // according to the resending function. After that the request is taken out from the resend queue.
                // TODO: How to set the timeout value?? Right now.. it is hard coded in the 'constants' class.
                var tihandle = setTimeout(function () {
                    var rentry = that.jcore.runTable.get(tmsg.actid);
                    if (rentry !== undefined && rentry.exception === true) {
                        if (cback != null && cback != '')
                            cback(params);
                    }
                    that.jcore.runTable.delete(tmsg.actid);
                }, globals.Timeouts.J2J_FOG);

                // Insert entry in the runTable with a null callback
                // We wait for the timeout to remove the entry. Until then the entry is going to
                // downcasted by the resending function..
                this.jcore.runTable.insert(tmsg.actid, tmsg, '/' + cmdopts.app +'/mach/func/request', function(rstatus) {
                    if (rstatus !== undefined && rstatus.type === 'ACK') {
                        that.jcore.runTable.delete(tmsg.actid);
                        clearTimeout(tihandle);
                    }
                });

                if (this.executeAsyncFunc(fentry, params, eres))
                    this.jcore.runTable.offException(tmsg.actid);
            }
            else
                this.executeAsyncFunc(fentry, params, eres);
        }
    }
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


module.exports = JCoreClient;
